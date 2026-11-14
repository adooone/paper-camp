import { PAPER_CAMP_VERSION } from '@/core/scaffold';
import {
  capabilitiesProbeKey,
  clearCapabilitiesCache,
  connectionsProbeKey,
  probeCapabilities,
  probeConnections,
  runConnect,
} from '../capabilities';
import { requestUrl, sendJson } from '../http';
import { cachedProbe } from '../probe-cache';
import type { Route, RouteContext } from './types';

const PROBE_TTL_MS = 60_000;

export function capabilitiesRoutes({ root, activity }: RouteContext): Route[] {
  const onChange = () => activity.notifyChanged('services');
  return [
    {
      method: 'GET',
      path: '/api/capabilities',
      handle: async (req, res) => {
        if (requestUrl(req).searchParams.has('recheck')) clearCapabilitiesCache(root);
        sendJson(res, 200, {
          capabilities: await cachedProbe(
            capabilitiesProbeKey(root),
            PROBE_TTL_MS,
            () => probeCapabilities(root),
            { onChange },
          ),
          version: PAPER_CAMP_VERSION,
        });
      },
    },
    {
      method: 'GET',
      path: '/api/connections',
      handle: async (req, res) => {
        if (requestUrl(req).searchParams.has('recheck')) clearCapabilitiesCache(root);
        sendJson(res, 200, {
          connections: await cachedProbe(
            connectionsProbeKey(root),
            PROBE_TTL_MS,
            () => probeConnections(root),
            { onChange },
          ),
        });
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
