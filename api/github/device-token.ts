import type { IncomingMessage, ServerResponse } from 'node:http';

// Self-contained by design: Vercel transpiles api/ functions without bundling
// repo-relative imports, so anything imported from outside api/ is
// unresolvable at runtime (ERR_MODULE_NOT_FOUND under "type": "module").
const DEFAULT_GITHUB_CLIENT_ID = 'Iv23ligLF1oQlhORSdew';

function githubClientId(): string {
  const configured = process.env.PAPERCAMP_GITHUB_CLIENT_ID?.trim();
  return configured || DEFAULT_GITHUB_CLIENT_ID;
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

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
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: githubClientId(),
      device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  });
  sendJson(res, response.status, await response.json());
}
