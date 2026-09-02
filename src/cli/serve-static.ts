import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function appDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
}

export async function loadIndexHtml(staticDir: string): Promise<string | null> {
  return readFile(join(staticDir, 'index.html'), 'utf-8').catch(() => null);
}

/** Serves the pre-built dashboard SPA (dist/app). `fallbackHtml` is what a request
 * for `/` or any unrecognized path receives — the caller decides whether that's the
 * plain index.html or one with a mount attribute injected for a sub-mounted project. */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
  fallbackHtml: string,
): Promise<void> {
  const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);

  // Prevent browsers from heuristically caching stale bundles across rebuilds.
  res.setHeader('Cache-Control', 'no-cache');

  if (pathname !== '/') {
    const filePath = join(staticDir, pathname);
    // join() normalizes `..`, so a crafted path like /../../.env would otherwise
    // escape staticDir and serve arbitrary files; treat it as the SPA fallback instead.
    const escapesStaticDir = filePath !== staticDir && !filePath.startsWith(staticDir + sep);
    try {
      const fileStat = escapesStaticDir ? null : await stat(filePath);
      if (fileStat?.isFile()) {
        res.statusCode = 200;
        res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream');
        res.end(await readFile(filePath));
        return;
      }
    } catch {
      // not a file on disk — fall through to the SPA fallback below
    }
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fallbackHtml);
}
