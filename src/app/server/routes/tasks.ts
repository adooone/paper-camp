import { readMaybe, taskLogFile } from '../helpers';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

const TASK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function taskRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      // Not `/tasks/log?id=…`: that shape reads as a tracking beacon to ad-blocker
      // filter lists, which killed the request with ERR_BLOCKED_BY_CLIENT.
      path: '/api/tasks/output',
      handle: async (req, res) => {
        const id = requestUrl(req).searchParams.get('id');
        if (!id || !TASK_ID_RE.test(id)) {
          sendJson(res, 400, { error: 'id must be a valid task id' });
          return;
        }
        const raw = await readMaybe(taskLogFile(root, id));
        sendJson(res, 200, { lines: raw ? raw.split('\n') : [] });
      },
    },
  ];
}
