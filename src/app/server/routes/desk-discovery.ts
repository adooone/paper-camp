import { gatherProjectEvidence } from '@/core/desk-discovery/evidence';
import { sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function deskDiscoveryRoutes({ root, agent }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/desk/discover',
      handle: async (_req, res) => {
        try {
          const evidence = await gatherProjectEvidence(root);
          const proposal = await agent.runDeskDiscovery(evidence);
          sendJson(res, 200, { proposal });
        } catch (error) {
          sendJson(res, 400, { error: (error as Error).message });
        }
      },
    },
  ];
}
