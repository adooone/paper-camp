import { clearCiCacheEntry, fetchCiReleaseState } from '@/core/ci';
import { loadDeskConfig } from '@/core/desk-config';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function ciRoutes({ root }: RouteContext): Route[] {
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
        if (requestUrl(req).searchParams.get('fresh') === '1') clearCiCacheEntry(root, ci);
        sendJson(res, 200, await fetchCiReleaseState(root, ci));
      },
    },
  ];
}
