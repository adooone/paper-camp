import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntities, readWorkEntries } from '@/core/readers';
import { normalizeRunOrder } from '@/core/run-order';
import {
  archiveEntityFile,
  assignEntityId,
  formatEntityFile,
  todayDateString,
} from '@/core/serialize';
import {
  AGENT_IDS,
  type AgentId,
  type EntityEntry,
  type LogEntry,
  PLAN_KINDS,
  type PhaseItem,
  type PlanStatus,
} from '@/types/index';
import {
  campFile,
  checkBranchConflictForPlan,
  entityFileInput,
  fileExists,
  readMaybe,
  regenerateIndexes,
  writeEntityFile,
} from '../../helpers';
import { readBody, requestUrl, sendJson } from '../../http';
import type { Route, RouteContext } from '../types';

function findWorkEntity(
  entries: EntityEntry[],
  key: string,
  opts?: { includeNotes?: boolean },
): EntityEntry | undefined {
  return entries.find(
    (e) => (opts?.includeNotes || e.kind !== 'note') && (e.title === key || e.id === key),
  );
}

export function planRoutes({ root, git }: RouteContext): Route[] {
  return [
    {
      method: 'DELETE',
      path: '/api/plans',
      handle: async (req, res) => {
        const title = requestUrl(req).searchParams.get('title');
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = findWorkEntity(entries, title.trim());
        if (!target) {
          sendJson(res, 404, { error: 'entity not found' });
          return;
        }
        const filePath = join(ideasDir, `${target.id}.md`);
        if (!(await fileExists(filePath))) {
          sendJson(res, 404, { error: 'entity file not found' });
          return;
        }
        await unlink(filePath);
        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/plans',
      handle: async (req, res) => {
        const body = await readBody(req);
        const { title, content, kind } = JSON.parse(body) as {
          title: string;
          content?: string;
          kind?: string;
        };
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        // The UI disables this client-side, but a stale-branch request must not
        // create an entity by bypassing that check.
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const type =
          kind && PLAN_KINDS.includes(kind as (typeof PLAN_KINDS)[number]) ? kind : 'feat';

        const configPath = join(root, 'papercamp', 'config.json');
        const id = await assignEntityId(configPath);

        if (!id) {
          sendJson(res, 500, { error: 'could not assign entity ID' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        await mkdir(ideasDir, { recursive: true });

        const entityContent = formatEntityFile({
          id,
          title: title.trim(),
          type,
          status: 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(ideasDir, `${id}.md`), `${entityContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id });
      },
    },

    {
      method: 'PATCH',
      path: '/api/plans',
      handle: async (req, res) => {
        const title = requestUrl(req).searchParams.get('title');
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const reqBody = await readBody(req);
        const updates = JSON.parse(reqBody) as {
          body?: string;
          phases?: PhaseItem[];
          /** `null` clears the stored override (e.g. reopening a dropped plan). */
          status?: PlanStatus | null;
          log?: LogEntry[];
          agent?: AgentId | null;
          subject?: string | null;
          order?: number | null;
        };
        if (updates.agent && !AGENT_IDS.includes(updates.agent)) {
          sendJson(res, 400, { error: 'agent must be a known agent id' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        // order is the one field notes can carry too — the up/down worklist
        // controls need to reorder a note against its plan/idea neighbours.
        const target = findWorkEntity(entries, title.trim(), { includeNotes: true });

        if (!target) {
          sendJson(res, 404, { error: 'entity not found' });
          return;
        }

        // target may be archived (done/dropped); resolve either location or
        // reopening an archived entity 404s.
        const primaryFile = join(ideasDir, `${target.id}.md`);
        const targetFile = (await fileExists(primaryFile))
          ? primaryFile
          : join(ideasDir, 'archive', `${target.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) {
          sendJson(res, 404, { error: 'entity file not found' });
          return;
        }

        const updatedEntry: EntityEntry = {
          ...target,
          ...(updates.body !== undefined && { body: updates.body }),
          ...(updates.status !== undefined && { status: updates.status ?? undefined }),
          ...(updates.phases !== undefined && { phases: updates.phases }),
          ...(updates.log !== undefined && { log: updates.log }),
          ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
          ...(updates.subject !== undefined && { subject: updates.subject ?? undefined }),
          ...(updates.order !== undefined && { order: updates.order ?? undefined }),
          updated: todayDateString(),
        };

        // Closing (done/dropped) is intentionally NOT branch-guarded: it isn't starting
        // new work, and approval typically happens after the branch is already merged.

        if (updates.status === 'in-progress') {
          for (const other of entries) {
            if (other.id !== target.id && other.kind !== 'note' && other.status === 'in-progress') {
              const otherFile = join(ideasDir, `${other.id}.md`);
              if (await fileExists(otherFile)) {
                await writeEntityFile(
                  otherFile,
                  entityFileInput(other, { status: 'planned', updated: todayDateString() }),
                );
              }
            }
          }
        }

        await writeEntityFile(targetFile, entityFileInput(updatedEntry));

        // Any status/order write can break the run-order invariant (contiguous
        // 1..N over planned/in-progress/review); reflow the rest to restore it.
        // Classification uses DERIVED status (readWorkEntries) — stored overrides
        // lag reality (merged-PR entries stay `review`, phased ideas stay `idea`).
        if (updates.order !== undefined || updates.status !== undefined) {
          const moved =
            typeof updates.order === 'number' ? { id: target.id, order: updates.order } : undefined;
          const { entries: work } = await readWorkEntries(ideasDir);
          const derived = new Map(work.map((w) => [w.id, w.status as string | undefined]));
          const nextEntries = entries.map((e) => (e.id === target.id ? updatedEntry : e));
          // Notes have no derived PlanStatus (readWorkEntries excludes them), so they sit
          // outside the planned/in-progress/review invariant reflow enforces — leave their
          // order as written rather than have them read as unordered and get cleared.
          const classified = nextEntries
            .filter((e) => e.kind !== 'note')
            .map((e) => ({
              id: e.id,
              order: e.order,
              created: e.created,
              status:
                e.id === target.id && updates.status !== undefined
                  ? (updates.status ?? undefined)
                  : (derived.get(e.id) ?? e.status),
            }));
          for (const change of normalizeRunOrder(classified, moved)) {
            const primaryFile = join(ideasDir, `${change.id}.md`);
            const file = (await fileExists(primaryFile))
              ? primaryFile
              : join(ideasDir, 'archive', `${change.id}.md`);
            if (!(await fileExists(file))) continue;
            const changedEntry = nextEntries.find((e) => e.id === change.id);
            if (!changedEntry) continue;
            await writeEntityFile(file, entityFileInput({ ...changedEntry, order: change.order }));
          }
        }

        await regenerateIndexes(root);

        // `done` is derived from a merged PR and needs no archiving; `dropped` has no
        // such signal, so it's the one status that still archives on write.
        if (updates.status === 'dropped') {
          await archiveEntityFile(root, target.id);
        }

        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
