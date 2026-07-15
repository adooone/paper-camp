import { clearPrCache } from '@/core/git-pr';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function statusRoutes({ activity, agent, git, status }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/status',
      handle: (_req, res) => {
        sendJson(res, 200, status.getStatus());
      },
    },

    // Drops the resolved-PR cache so the *next* worklist read re-shells out to
    // `gh` instead of serving up to PR_CACHE_TTL_MS-old review state. Without
    // this a manual refresh would re-render the same stale PR/review signal.
    {
      method: 'POST',
      path: '/api/refresh',
      handle: (_req, res) => {
        clearPrCache();
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/status/check',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (name !== 'lint' && name !== 'format' && name !== 'test' && name !== 'consistency') {
          sendJson(res, 400, { error: 'name must be lint, format, test, or consistency' });
          return;
        }
        status.runCheck(name);
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/status/fix',
      handle: (_req, res) => {
        status.runQualityFix();
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
      },
    },
  ];
}
