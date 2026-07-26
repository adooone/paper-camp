import { sendJson } from '../../http';
import { applyMergePolicy, getMergePolicy } from '../../merge-policy';
import type { Route, RouteContext } from '../types';

export function mergePolicyRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/merge-policy',
      handle: async (_req, res) => {
        sendJson(res, 200, await getMergePolicy(root));
      },
    },
    {
      method: 'POST',
      path: '/api/merge-policy/apply',
      handle: async (_req, res) => {
        sendJson(res, 200, await applyMergePolicy(root));
      },
    },
  ];
}
