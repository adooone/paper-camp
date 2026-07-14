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
