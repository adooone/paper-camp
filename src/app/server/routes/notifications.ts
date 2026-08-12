import { readBody, sendJson } from '../http';
import { markNotificationRead } from '../notification-log';
import type { Route, RouteContext } from './types';

export function notificationRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/notifications/mark-read',
      handle: async (req, res) => {
        const { id } = JSON.parse(await readBody(req)) as { id?: string };
        if (!id) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        await markNotificationRead(root, id);
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
