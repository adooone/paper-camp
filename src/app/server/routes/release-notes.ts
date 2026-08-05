import { resolveReleaseNotes } from '@/core/release-notes';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function releaseNotesRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/release-notes',
      handle: async (req, res) => {
        const version = requestUrl(req).searchParams.get('version');
        if (!version) {
          sendJson(res, 400, { error: 'version is required' });
          return;
        }
        sendJson(res, 200, await resolveReleaseNotes(root, version));
      },
    },
  ];
}
