import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function checkRoutes({ checks }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/checks',
      handle: (_req, res) => {
        sendJson(res, 200, { checks: checks.getStatus() });
      },
    },

    {
      method: 'POST',
      path: '/api/checks/run',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        try {
          checks.runCheck(name);
        } catch (err) {
          sendJson(res, 404, { error: (err as Error).message });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },
  ];
}
