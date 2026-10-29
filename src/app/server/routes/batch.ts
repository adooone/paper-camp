import { readFile } from 'node:fs/promises';
import { batchReadiness } from '@/core/batch-readiness';
import { type BatchRunRules, readBatchRunState } from '@/core/batch-run';
import { readCapacity } from '@/core/capacity';
import { readCorpus } from '@/core/corpus';
import { localFile } from '@/core/local-paths';
import { readTaskLog } from '@/core/parse';
import { readProjectConfig } from '@/core/project-config';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import { medianPhaseCostUsd } from '@/core/stats';
import { resolveAgent } from '../agents';
import { checkStaleBaseForRunAll, readRunOrderFile } from '../helpers';
import { readJson, sendJson } from '../http';
import type { Route, RouteContext } from './types';

function runnablePhaseCount(items: { done: boolean; source?: string }[]): number {
  return items.filter((item) => !item.done && item.source !== 'manual').length;
}

export function parseBatchRules(raw: unknown): Partial<BatchRunRules> {
  const {
    pickupUnblocked,
    ceiling,
    floor,
    onCeiling,
    stopAtMs,
    maxIdeas,
    maxCostUsd,
    branchPerIdea,
  } = (raw ?? {}) as Partial<BatchRunRules>;
  return {
    ...(typeof pickupUnblocked === 'boolean' && { pickupUnblocked }),
    ...(typeof ceiling === 'number' && { ceiling }),
    ...(typeof floor === 'number' && { floor }),
    ...((onCeiling === 'wait' || onCeiling === 'stop') && { onCeiling }),
    ...(typeof stopAtMs === 'number' && { stopAtMs }),
    ...(typeof maxIdeas === 'number' && { maxIdeas }),
    ...(typeof maxCostUsd === 'number' && { maxCostUsd }),
    ...(typeof branchPerIdea === 'boolean' && { branchPerIdea }),
  };
}

export function batchRoutes({ root, git, agent, checks }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/batch/preview',
      handle: async (_req, res) => {
        const [{ entries, work }, list, taskLogRaw, snapshot, capacity] = await Promise.all([
          readCorpus(root),
          readRunOrderFile(root),
          readFile(localFile(root, 'tasks.log'), 'utf-8').catch(() => ''),
          git.getStatusSnapshot(),
          readCapacity(),
        ]);
        const hygiene = await git.getBranchHygieneStatus(snapshot);
        const ahead = snapshot.hasUpstream ? snapshot.ahead : hygiene.ahead;
        const behind = snapshot.hasUpstream ? snapshot.behind : hygiene.behind;
        const diverged = ahead > 0 && behind > 0;
        const dirty = snapshot.entries.length > 0;
        const level = dirty ? 'dirty' : diverged ? 'diverged' : behind > 0 ? 'behind' : 'clean';

        // A blocking need keeps an idea out of run-order.md (IDEA-291), but the batch
        // preview still lists it — with its `needs` reason — rather than hiding it, so
        // classification here never marks an entry blocked by needs.
        const classified = classifyRunOrderEntries(entries, work);
        const order = normalizeRunOrder(list, classified);

        const defaultAgents = readProjectConfig(root).defaultAgents;
        const perPhaseUsd = medianPhaseCostUsd(readTaskLog(taskLogRaw));

        const items = await Promise.all(
          order.map(async ({ id, title }) => {
            const plan = work.find((p) => p.id === id);
            const phases = plan?.phases ?? [];
            const fixes = plan?.fixes ?? [];
            const staleBase = await checkStaleBaseForRunAll(git, id);
            const hasAgent = Boolean(
              resolveAgent({ agentId: plan?.agent, defaultAgents, taskKind: 'run-all' }).adapter,
            );
            const readiness = batchReadiness({
              resolvedNeeds: plan?.resolvedNeeds,
              phases,
              fixes,
              thread: plan?.thread,
              staleBase,
              hasAgent,
            });
            const phaseCount = runnablePhaseCount(phases) + runnablePhaseCount(fixes);
            return {
              id,
              title,
              readiness,
              phaseCount,
              costEstimateUsd: perPhaseUsd === undefined ? null : perPhaseUsd * phaseCount,
            };
          }),
        );

        sendJson(res, 200, {
          order: items,
          readyCount: items.filter((item) => item.readiness.ready).length,
          costEstimate: { perPhaseUsd: perPhaseUsd ?? null },
          capacity,
          git: { level, behind, diverged, dirty },
        });
      },
    },

    {
      method: 'GET',
      path: '/api/batch/status',
      handle: async (_req, res) => {
        const batch = await readBatchRunState(root);
        if (!batch) {
          sendJson(res, 200, { batch: null, task: null, ideaTask: null });
          return;
        }
        const tasks = agent.getStatus();
        const task = tasks.find((t) => t.id === batch.taskId) ?? null;
        const runningItem = batch.items.find((item) => item.outcome === 'running');
        const ideaTask = runningItem?.taskId
          ? (tasks.find((t) => t.id === runningItem.taskId) ?? null)
          : null;
        sendJson(res, 200, { batch, task, ideaTask });
      },
    },

    {
      method: 'POST',
      path: '/api/batch/start',
      handle: async (req, res) => {
        const { ids, rules } = (await readJson<{ ids?: unknown; rules?: unknown }>(req)) ?? {};
        if (
          !Array.isArray(ids) ||
          ids.length === 0 ||
          !ids.every((id) => typeof id === 'string' && id.trim().length > 0)
        ) {
          sendJson(res, 400, { error: 'ids is required' });
          return;
        }
        const result = agent.startBatchRun(
          ids,
          parseBatchRules(rules),
          () => checks.runChecksAndWait(),
          () => checks.getCachedOrRunChecks(),
        );
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/batch/control',
      handle: async (req, res) => {
        const { action } = (await readJson<{ action?: string }>(req)) ?? {};
        if (
          action !== 'stop' &&
          action !== 'stop-after-phase' &&
          action !== 'stop-after-idea' &&
          action !== 'skip'
        ) {
          sendJson(res, 400, { error: 'action is required' });
          return;
        }
        const result = agent.controlBatchRun(action);
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/batch/resume',
      handle: async (_req, res) => {
        const result = await agent.resumeBatchRun(() => checks.runChecksAndWait());
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/batch/end',
      handle: async (_req, res) => {
        const result = await agent.endPausedBatch();
        if (!result.ok) {
          sendJson(res, 409, { error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
