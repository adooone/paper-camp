import { readMaybe, taskLogFile } from '../helpers';
import { requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

const TASK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function taskRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/tasks/log',
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
