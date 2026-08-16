import { clearCiCache } from '@/core/ci';
import { clearPrCache, resolvePrsByEntity } from '@/core/git-pr';
import { invalidateCorpusCache } from '../corpus-cache';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function statusRoutes({
  root,
  activity,
  agent,
  git,
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
        clearPrCache();
        clearCiCache();
        // The corpus cache bakes PR state into each entry and is only invalidated by
        // the file watcher, so a PR appearing on GitHub alone wouldn't refresh it.
        invalidateCorpusCache();
        // Clearing memory alone isn't enough: the next read reloads pr-map.json with its
        // original `fetchedAt`, which re-arms the TTL and serves stale. ttl 0 forces the
        // live fetch, which re-persists on success and keeps the old map on failure.
        await resolvePrsByEntity(root, 0);
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/status/check',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (name !== 'consistency') {
          sendJson(res, 400, { error: 'name must be consistency' });
          return;
        }
        status.runCheck(name);
        sendJson(res, 202, { ok: true });
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
        git.subscribe(res);
        status.subscribe(res);
        agent.subscribe(res);
        services.subscribe(res);
        checks.subscribe(res);
      },
    },
  ];
}
