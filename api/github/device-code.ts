import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from '../../src/app/server/http';
import { requestDeviceCode } from '../../src/app/services/github/device-flow';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const { status, body } = await requestDeviceCode();
  sendJson(res, status, body);
}
