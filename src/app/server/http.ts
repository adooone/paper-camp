import type { IncomingMessage, ServerResponse } from 'node:http';

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/** Parsed request URL for query-param access — the host part only anchors parsing. */
export function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
}
