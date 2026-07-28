import {
  resolveEntityIdForCommit,
  resolveEntityTrail,
  resolveIdFromCommitMessage,
} from '@/core/trail';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function trailRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/trail',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id) {
          sendJson(res, 400, { error: 'id is required' });
          return;
        }
        sendJson(res, 200, await resolveEntityTrail(root, id));
      },
    },

    {
      method: 'GET',
      path: '/api/trail/reverse',
      handle: async (req, res) => {
        const params = requestUrl(req).searchParams;
        const sha = params.get('sha');
        const line = params.get('line');
        if (!sha && !line) {
          sendJson(res, 400, { error: 'sha or line is required' });
          return;
        }
        const id = sha
          ? await resolveEntityIdForCommit(root, sha)
          : resolveIdFromCommitMessage(line as string);
        sendJson(res, 200, { id });
      },
    },
  ];
}
