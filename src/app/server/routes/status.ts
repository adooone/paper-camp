import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function statusRoutes({ activity, agent, git, status }: RouteContext): Route[] {
  return [
    // GET /api/status — return current lint/format/test check results
    {
      method: 'GET',
      path: '/api/status',
      handle: (_req, res) => {
        sendJson(res, 200, status.getStatus());
      },
    },

    // POST /api/status/check?name=lint|format|test|consistency — trigger a one-off check run
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

    // POST /api/status/fix — run `biome check . --write` to auto-fix lint/format issues
    {
      method: 'POST',
      path: '/api/status/fix',
      handle: (_req, res) => {
        status.runQualityFix();
        sendJson(res, 202, { ok: true });
      },
    },

    // GET /api/activity/stream — SSE endpoint for live activity events
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
