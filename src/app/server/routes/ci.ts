import { clearCiCacheEntry, fetchCiReleaseState } from '@/core/ci';
import { loadDeskConfig } from '@/core/desk-config';
import { requestUrl, sendJson } from '../http';
import { cachedProbe } from '../probe-cache';
import type { Route, RouteContext } from './types';

const CI_PROBE_TTL_MS = 60_000;

export function ciRoutes({ root, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/ci',
      handle: async (req, res) => {
        const ci = loadDeskConfig(root).ci ?? null;
        if (!ci) {
          sendJson(res, 200, null);
          return;
        }
        const fresh = requestUrl(req).searchParams.get('fresh') === '1';
        if (fresh) clearCiCacheEntry(root, ci);
        const load = () => {
          clearCiCacheEntry(root, ci);
          return fetchCiReleaseState(root, ci);
        };
        sendJson(
          res,
          200,
          await cachedProbe(`ci:${root}:${ci.repo}:${ci.branch ?? ''}`, CI_PROBE_TTL_MS, load, {
            fresh,
            onChange: () => activity.notifyChanged('ci'),
          }),
        );
      },
    },
  ];
}
