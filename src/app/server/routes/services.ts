import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function serviceRoutes({ services }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/services',
      handle: async (_req, res) => {
        sendJson(res, 200, { services: await services.getStatus() });
      },
    },

    {
      method: 'POST',
      path: '/api/services/start',
      handle: async (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        try {
          await services.start(name);
        } catch (err) {
          sendJson(res, 404, { error: (err as Error).message });
          return;
        }
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/services/stop',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        services.stop(name);
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'GET',
      path: '/api/services/logs',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        const log = services.getLog(name);
        if (log === null) {
          sendJson(res, 404, { error: `No service named "${name}" in the desk manifest` });
          return;
        }
        sendJson(res, 200, { name, log });
      },
    },
  ];
}
