import { PAPER_CAMP_VERSION } from '@/core/scaffold';
import {
  clearAgentAuthStatusCache,
  clearCapabilitiesCache,
  probeCapabilities,
  probeConnections,
  runConnect,
} from '../capabilities';
import { requestUrl, sendJson } from '../http';
import { cachedProbe, clearProbe } from '../probe-cache';
import type { Route, RouteContext } from './types';

const PROBE_TTL_MS = 60_000;

export function capabilitiesRoutes({ root, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/capabilities',
      handle: async (req, res) => {
        const recheck = requestUrl(req).searchParams.has('recheck');
        if (recheck) clearCapabilitiesCache(root);
        const load = () => {
          clearCapabilitiesCache(root);
          return probeCapabilities(root);
        };
        sendJson(res, 200, {
          capabilities: await cachedProbe(`capabilities:${root}`, PROBE_TTL_MS, load, {
            fresh: recheck,
            onChange: () => activity.notifyChanged('services'),
          }),
          version: PAPER_CAMP_VERSION,
        });
      },
    },
    {
      method: 'GET',
      path: '/api/connections',
      handle: async (req, res) => {
        const recheck = requestUrl(req).searchParams.has('recheck');
        if (recheck) {
          clearCapabilitiesCache(root);
          clearAgentAuthStatusCache(root);
        }
        const load = () => {
          clearCapabilitiesCache(root);
          return probeConnections(root);
        };
        sendJson(res, 200, {
          connections: await cachedProbe(`connections:${root}`, PROBE_TTL_MS, load, {
            fresh: recheck,
            onChange: () => activity.notifyChanged('services'),
          }),
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
        clearProbe(`connections:${root}`);
        sendJson(res, 200, { connection });
      },
    },
  ];
}
