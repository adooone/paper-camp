import type { IncomingMessage, ServerResponse } from 'node:http';
import { readBody, sendJson } from '../../src/app/server/http';
import { requestDeviceToken } from '../../src/app/services/github/device-flow';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const requestBody = await readBody(req);
  const { device_code } = JSON.parse(requestBody || '{}') as { device_code?: string };
  if (!device_code) {
    sendJson(res, 400, { error: 'device_code is required' });
    return;
  }
  const { status, body } = await requestDeviceToken(device_code);
  sendJson(res, status, body);
}
