import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readEntities } from '../../../core/readers';
import {
  archiveEntityFile,
  assignEntityId,
  formatEntityFile,
  todayDateString,
} from '../../../core/serializer';
import {
  AGENT_IDS,
  type AgentId,
  type EntityEntry,
  type LogEntry,
  PLAN_KINDS,
  type PhaseItem,
  type PlanStatus,
} from '../../../types/index';
import {
  campFile,
  checkBranchConflictForPlan,
  entityFileInput,
  fileExists,
  readMaybe,
  regenerateIndexes,
  writeEntityFile,
} from '../helpers';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

/** Work entities only (never notes), matched by title or id. */
function findWorkEntity(entries: EntityEntry[], key: string): EntityEntry | undefined {
  return entries.find((e) => e.kind !== 'note' && (e.title === key || e.id === key));
}

export function planRoutes({ root, git }: RouteContext): Route[] {
  return [
    // DELETE /api/plans?title=... — remove a work entity from the corpus
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

    // POST /api/plans — create a new work entity ("Quick plan": status idea, typed)
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

    // PATCH /api/plans?title=... — update an existing work entity
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
          status?: PlanStatus;
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

        const targetFile = join(ideasDir, `${target.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) {
          sendJson(res, 404, { error: 'entity file not found' });
          return;
        }

        const updatedEntry: EntityEntry = {
          ...target,
          ...(updates.body !== undefined && { body: updates.body }),
          ...(updates.status !== undefined && { status: updates.status }),
          ...(updates.phases !== undefined && { phases: updates.phases }),
          ...(updates.log !== undefined && { log: updates.log }),
          ...(updates.agent !== undefined && { agent: updates.agent ?? undefined }),
          updated: todayDateString(),
        };

        if (updates.status === 'done' || updates.status === 'dropped') {
          const conflict = await checkBranchConflictForPlan(root, git, target.id);
          if (conflict) {
            sendJson(res, 409, { error: conflict });
            return;
          }
        }

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

        if (updates.status === 'done' || updates.status === 'dropped') {
          await archiveEntityFile(root, target.id);
        }

        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
