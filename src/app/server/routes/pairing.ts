import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function pairingRoutes({ pairing }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/pair',
      handle: async (req, res) => {
        const origin = req.headers.origin;
        if (!origin) {
          sendJson(res, 400, { error: 'Origin header is required to pair' });
          return;
        }
        const body = await readBody(req);
        const { token } = JSON.parse(body || '{}') as { token?: string };
        if (!token || !pairing.pair(token, origin)) {
          sendJson(res, 403, { error: 'Invalid pairing token' });
          return;
        }
        sendJson(res, 200, { paired: true, origin });
      },
    },
  ];
}
