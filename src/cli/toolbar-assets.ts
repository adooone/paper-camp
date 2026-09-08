import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_CONTENT_TYPES: Record<string, string> = {
  'toolbar.js': 'text/javascript; charset=utf-8',
  'toolbar.js.map': 'application/json; charset=utf-8',
};

export function toolbarDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'toolbar');
}

/** Serves the toolbar bundle (`dist/toolbar`) a host app's own Vite dev server proxies
 * requests for through `paperCamp()` — the one static asset this runtime still ships,
 * now that the dashboard itself is the hosted client. Returns false for any other
 * path so the caller can fall through to its own routing. */
export async function serveToolbarAsset(
  req: IncomingMessage,
  res: ServerResponse,
  dir: string = toolbarDir(),
): Promise<boolean> {
  const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\//, '');
  const contentType = ASSET_CONTENT_TYPES[name];
  if (!contentType) return false;

  const contents = await readFile(join(dir, name)).catch(() => null);
  if (contents === null) return false;

  res.statusCode = 200;
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', contentType);
  res.end(contents);
  return true;
}
