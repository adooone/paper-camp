import type { MergePolicy } from '@/types/index';
import { readJson, requestUrl, sendJson } from '../../http';
import { applyMergePolicy, getMergePolicy } from '../../merge-policy';
import { cachedProbe, clearProbe } from '../../probe-cache';
import type { Route, RouteContext } from '../types';

const MERGE_POLICY_TTL_MS = 5 * 60_000;

export function mergePolicyRoutes({ root, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/merge-policy',
      handle: async (req, res) => {
        const fresh = requestUrl(req).searchParams.get('fresh') === '1';
        sendJson(
          res,
          200,
          await cachedProbe(
            `merge-policy:${root}`,
            MERGE_POLICY_TTL_MS,
            () => getMergePolicy(root),
            {
              fresh,
              onChange: () => activity.notifyChanged('services'),
            },
          ),
        );
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
        const result = await applyMergePolicy(root, parsed as Partial<MergePolicy> | undefined);
        clearProbe(`merge-policy:${root}`);
        sendJson(res, 200, result);
      },
    },
  ];
}
