import { requestUrl, sendJson } from '../http';
import { discoverTailnetPeerRuntimes } from '../tailnet-discovery';
import type { Route, RouteContext } from './types';

export function tailnetDiscoveryRoutes(_ctx: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/tailnet/peers',
      handle: async (req, res) => {
        const refresh = requestUrl(req).searchParams.get('refresh') === '1';
        sendJson(res, 200, { peers: await discoverTailnetPeerRuntimes(refresh) });
      },
    },
  ];
}
