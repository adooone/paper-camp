import { readBody, sendJson } from '../http';
import { markNotificationRead } from '../notification-log';
import type { Route, RouteContext } from './types';

export function notificationRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/notifications/mark-read',
      handle: async (req, res) => {
        let id: unknown;
        try {
          ({ id } = JSON.parse(await readBody(req)) as { id?: unknown });
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        if (typeof id !== 'string' || !id.trim()) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        await markNotificationRead(root, id);
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
