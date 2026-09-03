import { probeCapacity } from '../capacity-probe';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function capacityRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/capacity/refresh',
      handle: async (_req, res) => {
        const snapshot = await probeCapacity(root);
        if (!snapshot) {
          sendJson(res, 503, { error: 'Claude reported no capacity — is the CLI signed in?' });
          return;
        }
        sendJson(res, 200, { snapshot, capturedAt: new Date().toISOString() });
      },
    },
  ];
}
