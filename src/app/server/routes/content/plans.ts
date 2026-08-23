import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntities, readWorkEntries } from '@/core/readers';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import { archiveEntityFile, todayDateString } from '@/core/serialize';
import { isClosedEntity } from '@/core/status';
import { replaceThreadKinds } from '@/core/thread';
import {
  AGENT_IDS,
  type AgentId,
  type EntityEntry,
  type LogEntry,
  type PhaseItem,
  type PlanStatus,
  type ThreadMessage,
} from '@/types/index';
import {
  campFile,
  entityFileInput,
  fileExists,
  readMaybe,
  readRunOrderFile,
  withRunOrderLock,
  writeEntityFile,
  writeRunOrderFile,
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
        sendJson(res, 200, { ok: true });
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
          fixes?: PhaseItem[];
          /** `null` clears the stored override (e.g. reopening a dropped plan). */
          status?: PlanStatus | null;
          log?: LogEntry[];
          thread?: ThreadMessage[];
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

        // A done/archived entity's own file is read-only (IDEA-187) — new phases or
        // fixes spawn their own linked fix entity instead of landing here.
        if (isClosedEntity(target)) {
          const addsPhases = (updates.phases?.length ?? 0) > target.phases.length;
          const addsFixes = (updates.fixes?.length ?? 0) > (target.fixes?.length ?? 0);
          const reopensStatus =
            updates.status !== undefined &&
            updates.status !== null &&
            updates.status !== 'done' &&
            updates.status !== 'dropped';
          if (addsPhases || addsFixes || reopensStatus || updates.body !== undefined) {
            sendJson(res, 409, {
              error: 'a done/archived entity is read-only — new work spawns its own fix entity',
            });
            return;
          }
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

        // Run order lives in papercamp/run-order.md, not frontmatter (IDEA-98); notes
        // aren't part of that list, so their `order` still writes straight to frontmatter.
        let thread = target.thread;
        if (updates.thread !== undefined) {
          thread = updates.thread;
        }
        if (updates.log !== undefined) {
          thread = replaceThreadKinds(
            thread,
            ['log'],
            updates.log.map((e) => ({ kind: 'log' as const, date: e.date, text: e.text })),
          );
        }

        const updatedEntry: EntityEntry = {
          ...target,
          ...(updates.body !== undefined && { body: updates.body }),
          ...(updates.status !== undefined && { status: updates.status ?? undefined }),
          ...(updates.phases !== undefined && { phases: updates.phases }),
          ...(updates.fixes !== undefined && { fixes: updates.fixes }),
          ...(thread !== target.thread && { thread }),
          ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
          ...(updates.subject !== undefined && { subject: updates.subject ?? undefined }),
          order:
            target.kind === 'note'
              ? updates.order !== undefined
                ? (updates.order ?? undefined)
                : target.order
              : undefined,
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
                  root,
                  otherFile,
                  entityFileInput(other, { status: 'planned', updated: todayDateString() }),
                );
              }
            }
          }
        }

        await writeEntityFile(root, targetFile, entityFileInput(updatedEntry));

        // A status/order write can break the run-order invariant (contiguous 1..N over
        // planned/in-progress/review); reflow using DERIVED status, since overrides can lag.
        if (
          target.kind !== 'note' &&
          (updates.order !== undefined || updates.status !== undefined)
        ) {
          const moved =
            typeof updates.order === 'number' ? { id: target.id, order: updates.order } : undefined;
          const { entries: work } = await readWorkEntries(ideasDir);
          const nextEntries = entries.map((e) => (e.id === target.id ? updatedEntry : e));
          const classified = classifyRunOrderEntries(nextEntries, work, (id) =>
            id === target.id && updates.status !== undefined
              ? { value: updates.status ?? undefined }
              : undefined,
          );
          await withRunOrderLock(async () => {
            const list = await readRunOrderFile(root);
            await writeRunOrderFile(root, normalizeRunOrder(list, classified, moved));
          });
        }

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
