import { MissingFixCmdError, UnknownCheckError } from '../desk-checks';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function checkRoutes({ checks }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/checks',
      handle: (_req, res) => {
        sendJson(res, 200, { checks: checks.getStatus() });
      },
    },

    {
      method: 'POST',
      path: '/api/checks/run',
      handle: (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        let promise: ReturnType<typeof checks.runCheck>;
        try {
          promise = checks.runCheck(name);
        } catch (err) {
          if (err instanceof UnknownCheckError) {
            sendJson(res, 404, { error: err.message });
            return;
          }
          sendJson(res, 500, { error: (err as Error).message });
          return;
        }
        // Fire-and-forget: the caller polls GET /api/checks for the outcome;
        // desk-checks already stores a run-time failure as that check's fail.
        promise.catch(() => {});
        sendJson(res, 202, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/checks/fix',
      handle: async (req, res) => {
        const { name } = JSON.parse(await readBody(req)) as { name?: string };
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        try {
          const check = await checks.runFix(name);
          sendJson(res, 200, { check });
        } catch (err) {
          if (err instanceof MissingFixCmdError) {
            sendJson(res, 400, { error: err.message });
            return;
          }
          if (err instanceof UnknownCheckError) {
            sendJson(res, 404, { error: err.message });
            return;
          }
          sendJson(res, 500, { error: (err as Error).message });
        }
      },
    },
  ];
}
