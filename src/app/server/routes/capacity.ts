import { readCapacity, writeCapacity } from '@/core/capacity';
import { probeCapacity } from '../capacity-probe';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function capacityRoutes({ root, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/capacity',
      handle: async (_req, res) => {
        sendJson(res, 200, await readCapacity());
      },
    },
    {
      method: 'POST',
      path: '/api/capacity/refresh',
      handle: async (_req, res) => {
        const snapshot = await probeCapacity(root);
        if (!snapshot) {
          sendJson(res, 503, { error: 'Claude reported no capacity — is the CLI signed in?' });
          return;
        }
        await writeCapacity(snapshot, 'probe');
        activity.publish({ type: 'capacity' });
        sendJson(res, 200, await readCapacity());
      },
    },
  ];
}
