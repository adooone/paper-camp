import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntities } from '@/core/readers';
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

/** Work entities only (never notes), matched by title or id. */
function findWorkEntity(entries: EntityEntry[], key: string): EntityEntry | undefined {
  return entries.find((e) => e.kind !== 'note' && (e.title === key || e.id === key));
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
        // Server-side branch-hygiene guard — the UI disables this client-side,
        // but a stale-branch request must not create an entity by bypassing it.
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
        };
        if (updates.agent && !AGENT_IDS.includes(updates.agent)) {
          sendJson(res, 400, { error: 'agent must be a known agent id' });
          return;
        }

        const ideasDir = campFile(root, 'ideas');
        const { entries } = await readEntities(ideasDir);
        const target = findWorkEntity(entries, title.trim());

        if (!target) {
          sendJson(res, 404, { error: 'entity not found' });
          return;
        }

        // readEntities scans ideas/ AND archive/, so target may be archived (done/
        // dropped). Resolve the file in either location — otherwise editing or
        // reopening an archived entity (e.g. clearing a dropped override) 404s.
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
          updated: todayDateString(),
        };

        // Closing a reviewed plan (done/dropped) is intentionally NOT branch-guarded:
        // it isn't starting new work, and the common flow is to approve/close after the
        // PR merges — by which point you're on main or a merged branch, not the plan's
        // own. The branch-conflict guard stays on the work-starting paths (agent launches
        // and plan creation).

        // Demote other in-progress entities when starting a new one
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
        await regenerateIndexes(root);

        // `done` is derived from a merged PR, so it never needs archiving on its own —
        // moving the file would just be a needless commit. `dropped` has no such signal,
        // so it stays the one status that still archives on write.
        if (updates.status === 'dropped') {
          await archiveEntityFile(root, target.id);
        }

        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
