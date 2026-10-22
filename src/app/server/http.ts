import type { IncomingMessage, ServerResponse } from 'node:http';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

const gzipAsync = promisify(gzip);

const GZIP_THRESHOLD_BYTES = 1024;

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  const body = JSON.stringify(data);
  const acceptEncoding = [res.req?.headers['accept-encoding'] ?? ''].flat().join(',');
  if (Buffer.byteLength(body) <= GZIP_THRESHOLD_BYTES || !acceptEncoding.includes('gzip')) {
    res.end(body);
    return;
  }
  res.setHeader('Vary', 'Accept-Encoding');
  gzipAsync(body)
    .then((compressed) => {
      res.setHeader('Content-Encoding', 'gzip');
      res.end(compressed);
    })
    .catch(() => res.end(body));
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

// Thrown instead of a plain Error so a route's dispatcher can answer with the right
// status code instead of always falling back to 500.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Parses the request body as JSON, or `undefined` for an empty body (callers that
 *  require a body still reject that themselves). A non-empty, malformed body throws
 *  `HttpError` so the dispatcher answers 400 instead of a parse-error 500. */
export async function readJson<T = unknown>(req: IncomingMessage): Promise<T | undefined> {
  const raw = await readBody(req);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, 'Malformed JSON body');
  }
}

/** Parsed request URL for query-param access — the host part only anchors parsing. */
export function requestUrl(req: IncomingMessage): URL {
  return new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
}
