import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_CONTENT_TYPES: Record<string, string> = {
  'toolbar.js': 'text/javascript; charset=utf-8',
  'toolbar.js.map': 'application/json; charset=utf-8',
};

function toolbarDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'toolbar');
}

function toolbarAssetName(req: IncomingMessage): string | undefined {
  const name = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\//, '');
  return name in ASSET_CONTENT_TYPES ? name : undefined;
}

/** Lets a caller apply CORS to a toolbar request before `serveToolbarAsset` answers
 * it, without duplicating the asset-name allowlist above. */
export function isToolbarAssetRequest(req: IncomingMessage): boolean {
  return toolbarAssetName(req) !== undefined;
}

const assetCache = new Map<string, Buffer>();

async function readCachedAsset(path: string): Promise<Buffer | null> {
  const cached = assetCache.get(path);
  if (cached) return cached;

  const contents = await readFile(path).catch(() => null);
  if (contents === null) return null;

  assetCache.set(path, contents);
  return contents;
}

/** Serves the toolbar bundle (`dist/toolbar`) — the one static asset this runtime
 * still ships, now that the dashboard itself is the hosted client. Returns false for
 * any other path so the caller can fall through to its own routing. The bundle only
 * changes on install/update, so reads are cached in memory keyed by full path. */
export async function serveToolbarAsset(
  req: IncomingMessage,
  res: ServerResponse,
  dir: string = toolbarDir(),
): Promise<boolean> {
  const name = toolbarAssetName(req);
  if (!name) return false;

  const contents = await readCachedAsset(join(dir, name));
  if (contents === null) return false;

  res.statusCode = 200;
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Content-Type', ASSET_CONTENT_TYPES[name]);
  res.end(contents);
  return true;
}
