import { randomUUID } from 'node:crypto';
import { clearCiCache } from '@/core/ci';
import {
  clearPrCache,
  entitiesWithNewChangesRequested,
  peekCachedPrs,
  resolvePrsByEntity,
} from '@/core/git-pr';
import { readEntities } from '@/core/readers';
import { invalidateCorpusCache } from '../corpus-cache';
import { campFile } from '../helpers';
import { sendJson } from '../http';
import { appendNotification } from '../notification-log';
import type { Route, RouteContext } from './types';

export function statusRoutes({
  root,
  activity,
  agent,
  status,
  services,
  checks,
}: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/status',
      handle: async (_req, res) => {
        sendJson(res, 200, await status.getStatus());
      },
    },

    // The one place that fetches GitHub on demand, now that nothing polls (IDEA-181).
    {
      method: 'POST',
      path: '/api/refresh',
      handle: async (_req, res) => {
        const previous = peekCachedPrs(root);
        await clearPrCache(root);
        clearCiCache();
        // The corpus cache bakes PR state into each entry and is only invalidated by
        // the file watcher, so a PR appearing on GitHub alone wouldn't refresh it.
        invalidateCorpusCache();
        // clearPrCache already zeroed the persisted fetchedAt, so this fetches live
        // regardless of TTL, re-persisting on success and keeping the old map on failure.
        const fresh = await resolvePrsByEntity(root);
        if (fresh) {
          const newlyRequested = entitiesWithNewChangesRequested(previous, fresh);
          if (newlyRequested.length > 0) {
            const { entries } = await readEntities(campFile(root, 'ideas'));
            for (const { entityId, pr } of newlyRequested) {
              const entity = entries.find((e) => e.id === entityId);
              void appendNotification(root, {
                id: randomUUID(),
                kind: 'pr-review-changes-requested',
                entityId,
                entityTitle: entity?.title ?? entityId,
                text: `PR #${pr.number} review requested changes`,
              });
            }
          }
        }
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'GET',
      path: '/api/activity/stream',
      handle: (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        activity.subscribe(res);
        agent.subscribe(res);
        services.subscribe(res);
        checks.subscribe(res);
      },
    },
  ];
}
