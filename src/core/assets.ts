import { readdir, stat } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import type { AssetEntry } from '../types/index';
import { readProjectConfig } from './project-config';

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  html: 'text/html',
  htm: 'text/html',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'application/pdf',
  log: 'text/plain',
};

const DEFAULT_MIME = 'application/octet-stream';

// Served with Content-Security-Policy: sandbox allow-scripts (no allow-same-origin),
// so a mockup an agent wrote can run its own script but can't call the daemon's
// API as the user (IDEA-322).
const SANDBOXED_MIMES = new Set(['text/html', 'image/svg+xml']);

export function mimeForAssetName(name: string): string {
  const ext = extname(name).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ?? DEFAULT_MIME;
}

export function sandboxCspForMime(mime: string): string | undefined {
  return SANDBOXED_MIMES.has(mime) ? 'sandbox allow-scripts' : undefined;
}

/** A name must be exactly one path segment, so `..` and a slash are refused —
 * both would otherwise escape `papercamp/assets/<id>/` (IDEA-322). */
export function isSafeAssetName(name: string): boolean {
  return name.length > 0 && name !== '.' && name !== '..' && name === basename(name);
}

const DEFAULT_MAX_FILE_SIZE_MB = 5;

export function assetMaxFileSizeMb(root: string): number {
  return readProjectConfig(root).raw?.assets?.maxFileSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
}

export function assetMaxBytes(root: string): number {
  return assetMaxFileSizeMb(root) * 1024 * 1024;
}

export function ideaAssetsDir(assetsDir: string, id: string): string {
  return join(assetsDir, id);
}

/** Lists one idea's folder under `papercamp/assets/<id>/` — the only source of
 * truth for its files (IDEA-322); a missing folder is just no assets, not an error. */
export async function listIdeaAssets(assetsDir: string, id: string): Promise<AssetEntry[]> {
  const dir = ideaAssetsDir(assetsDir, id);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const entries = await Promise.all(
    names.map(async (name) => {
      const stats = await stat(join(dir, name)).catch(() => undefined);
      if (!stats || !stats.isFile()) return undefined;
      const entry: AssetEntry = {
        name,
        size: stats.size,
        type: mimeForAssetName(name),
        modified: stats.mtime.toISOString(),
      };
      return entry;
    }),
  );
  return entries.filter((e): e is AssetEntry => e !== undefined);
}
