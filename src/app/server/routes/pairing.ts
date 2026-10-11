import { hostedClientUrl } from '@/core/hosted-client';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function pairingRoutes({ pairing, pairCode }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/pairing',
      handle: async (_req, res) => {
        sendJson(res, 200, { hostedClientUrl: hostedClientUrl(), token: pairing.token });
      },
    },
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
        const { token, code } = JSON.parse(body || '{}') as { token?: string; code?: string };
        // A pairing code (IDEA-292) stands in for the long token the caller doesn't
        // have yet — redeeming it pairs the same way, then hands the token back.
        if (code !== undefined) {
          if (!pairCode?.redeem(code, origin)) {
            sendJson(res, 403, { error: 'Invalid or expired pairing code' });
            return;
          }
          pairing.pair(pairing.token, origin);
          sendJson(res, 200, { token: pairing.token, origin });
          return;
        }
        if (!token || !pairing.pair(token, origin)) {
          sendJson(res, 403, { error: 'Invalid pairing token' });
          return;
        }
        sendJson(res, 200, { paired: true, origin });
      },
    },
  ];
}
