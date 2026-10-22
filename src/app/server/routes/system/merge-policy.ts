import type { MergePolicy } from '@/types/index';
import { readJson, sendJson } from '../../http';
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
        // No body at all means "apply the recommended policy" — applyMergePolicy's
        // own default — so only a present-but-malshaped body is rejected here.
        const parsed = await readJson(req);
        if (
          parsed !== undefined &&
          (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        ) {
          sendJson(res, 400, { error: 'body must be a JSON object' });
          return;
        }
        sendJson(
          res,
          200,
          await applyMergePolicy(root, parsed as Partial<MergePolicy> | undefined),
        );
      },
    },
  ];
}
