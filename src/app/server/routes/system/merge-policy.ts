import type { MergePolicy } from '@/types/index';
import { readBody, sendJson } from '../../http';
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
      handle: async (req, res) => {
        const raw = await readBody(req);
        let partial: Partial<MergePolicy> | undefined;
        if (raw) {
          try {
            partial = JSON.parse(raw) as Partial<MergePolicy>;
          } catch {
            sendJson(res, 400, { error: 'invalid JSON body' });
            return;
          }
        }
        sendJson(res, 200, await applyMergePolicy(root, partial));
      },
    },
  ];
}
