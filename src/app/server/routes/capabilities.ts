import { probeCapabilities, probeConnections } from '../capabilities';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function capabilitiesRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/capabilities',
      handle: async (_req, res) => {
        sendJson(res, 200, { capabilities: await probeCapabilities(root) });
      },
    },
    {
      method: 'GET',
      path: '/api/connections',
      handle: async (_req, res) => {
        sendJson(res, 200, { connections: await probeConnections(root) });
      },
    },
  ];
}
