import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parsePlanFile } from '../../../core/parser';
import { readAllPlanFiles } from '../../../core/readers';
import {
  archivePlanFile,
  assignPlanId,
  formatPlanFile,
  todayDateString,
} from '../../../core/serializer';
import {
  AGENT_IDS,
  type AgentId,
  type LogEntry,
  PLAN_KINDS,
  type PhaseItem,
  type PlanEntry,
  type PlanStatus,
} from '../../../types/index';
import {
  campFile,
  checkBranchConflictForPlan,
  fileExists,
  planFileInput,
  readMaybe,
  regenerateIndexes,
  writePlanFile,
} from '../helpers';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function planRoutes({ root, git }: RouteContext): Route[] {
  return [
    // DELETE /api/plans?title=... — remove a plan entry from per-file storage
    {
      method: 'DELETE',
      path: '/api/plans',
      handle: async (req, res) => {
        const title = requestUrl(req).searchParams.get('title');
        if (!title?.trim()) {
          sendJson(res, 400, { error: 'title is required' });
          return;
        }
        const plansDir = campFile(root, 'plans');
        const trimmed = title.trim();
        const { entries } = await readAllPlanFiles(plansDir);
        const target = entries.find((e) => e.title === trimmed || e.id === trimmed);
        if (!target?.id) {
          sendJson(res, 404, { error: 'plan not found in per-file storage' });
          return;
        }
        const filePath = join(plansDir, `${target.id}.md`);
        if (!(await fileExists(filePath))) {
          sendJson(res, 404, { error: 'plan file not found' });
          return;
        }
        await unlink(filePath);
        await regenerateIndexes(root);
        sendJson(res, 200, { ok: true });
      },
    },

    // POST /api/plans — create a new per-file plan entry
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
        // Server-side branch-hygiene guard — the sidebar disables this client-side,
        // but a stale-branch request must not create a plan by bypassing the UI.
        const conflict = await checkBranchConflictForPlan(root, git);
        if (conflict) {
          sendJson(res, 409, { error: conflict });
          return;
        }
        const planKind =
          kind && PLAN_KINDS.includes(kind as (typeof PLAN_KINDS)[number]) ? kind : 'feat';

        const configPath = join(root, 'papercamp', 'config.json');
        const id = await assignPlanId(configPath, planKind);

        if (!id) {
          sendJson(res, 500, { error: 'could not assign plan ID' });
          return;
        }

        const plansDir = campFile(root, 'plans');
        await mkdir(plansDir, { recursive: true });

        const planContent = formatPlanFile({
          id,
          title: title.trim(),
          kind: planKind,
          status: 'idea',
          created: todayDateString(),
          body: content?.trim(),
        });
        await writeFile(join(plansDir, `${id}.md`), `${planContent}\n`, 'utf-8');
        await regenerateIndexes(root);
        sendJson(res, 201, { ok: true, id });
      },
    },

    // PATCH /api/plans?title=... — update an existing plan entry
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

        const plansDir = campFile(root, 'plans');
        const { entries } = await readAllPlanFiles(plansDir);
        const trimmed = title.trim();
        const target = entries.find((e) => e.title === trimmed || e.id === trimmed);

        if (!target?.id) {
          sendJson(res, 404, { error: 'plan not found' });
          return;
        }

        const targetFile = join(plansDir, `${target.id}.md`);
        const raw = await readMaybe(targetFile);
        if (!raw) {
          sendJson(res, 404, { error: 'plan file not found' });
          return;
        }

        const parsed = parsePlanFile(raw);
        if (parsed.entries.length === 0) {
          sendJson(res, 500, { error: 'failed to parse plan file' });
          return;
        }

        const updatedEntry: PlanEntry = {
          ...parsed.entries[0],
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

        // Demote other in-progress plans when starting a new one
        if (updates.status === 'in-progress') {
          const allPlans = await readAllPlanFiles(plansDir);
          for (const other of allPlans.entries) {
            if (other.id !== target.id && other.status === 'in-progress') {
              const otherFile = join(plansDir, `${other.id}.md`);
              const otherRaw = await readMaybe(otherFile);
              if (otherRaw) {
                const otherParsed = parsePlanFile(otherRaw);
                if (otherParsed.entries.length > 0) {
                  await writePlanFile(
                    otherFile,
                    planFileInput(otherParsed.entries[0], {
                      id: otherParsed.entries[0].id ?? other.id!,
                      status: 'planned',
                      updated: todayDateString(),
                    }),
                  );
                }
              }
            }
          }
        }

        await writePlanFile(
          targetFile,
          planFileInput(updatedEntry, { id: updatedEntry.id ?? target.id }),
        );
        await regenerateIndexes(root);

        if (updates.status === 'done' || updates.status === 'dropped') {
          await archivePlanFile(root, target.id);
          try {
            git.ensureBranch(updatedEntry);
          } catch {
            // Non-fatal
          }
        }

        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
