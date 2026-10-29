import { readFile } from 'node:fs/promises';
import { batchReadiness } from '@/core/batch-readiness';
import { readCapacity } from '@/core/capacity';
import { readCorpus } from '@/core/corpus';
import { localFile } from '@/core/local-paths';
import { readTaskLog } from '@/core/parse';
import { readProjectConfig } from '@/core/project-config';
import { classifyRunOrderEntries, normalizeRunOrder } from '@/core/run-order';
import { medianPhaseCostUsd } from '@/core/stats';
import { resolveAgent } from '../agents';
import { checkStaleBaseForRunAll, readRunOrderFile } from '../helpers';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

function runnablePhaseCount(items: { done: boolean; source?: string }[]): number {
  return items.filter((item) => !item.done && item.source !== 'manual').length;
}

export function batchRoutes({ root, git }: RouteContext): Route[] {
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
  ];
}
