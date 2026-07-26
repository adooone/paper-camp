import { probeCapabilities, probeConnections, runConnect } from '../capabilities';
import { requestUrl, sendJson } from '../http';
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
    {
      method: 'POST',
      path: '/api/connections/connect',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        const connection = await runConnect(id, root);
        if (!connection) {
          sendJson(res, 404, { error: `Unknown service: ${id}` });
          return;
        }
        sendJson(res, 200, { connection });
      },
    },
  ];
}
