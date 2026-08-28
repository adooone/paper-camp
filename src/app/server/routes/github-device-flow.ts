import { requestDeviceCode, requestDeviceToken } from '@/app/services/github/device-flow';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function githubDeviceFlowRoutes(_ctx: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/github/device-code',
      handle: async (_req, res) => {
        const { status, body } = await requestDeviceCode();
        sendJson(res, status, body);
      },
    },
    {
      method: 'POST',
      path: '/api/github/device-token',
      handle: async (req, res) => {
        const requestBody = await readBody(req);
        const { device_code } = JSON.parse(requestBody || '{}') as { device_code?: string };
        if (!device_code) {
          sendJson(res, 400, { error: 'device_code is required' });
          return;
        }
        const { status, body } = await requestDeviceToken(device_code);
        sendJson(res, status, body);
      },
    },
  ];
}
