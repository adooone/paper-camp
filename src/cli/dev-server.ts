import { readFile, stat } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { dirname, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from '../app/server/api';

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

function appDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'app');
}

export interface DevServerOptions {
  root: string;
  port: number;
}

/** Serves the pre-built dashboard SPA (dist/app), for an installed package
 * where there's no Vite runtime available (it's a devDependency). */
export async function startDevServer({ root, port }: DevServerOptions): Promise<void> {
  const staticDir = appDir();
  const indexPath = join(staticDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf-8').catch(() => null);
  if (indexHtml === null) {
    throw new Error(
      `Dashboard assets not found at ${staticDir}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`,
    );
  }

  const apiMiddleware = createApiMiddleware(root);

  async function serveStatic(req: IncomingMessage, res: ServerResponse) {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const filePath = join(staticDir, pathname === '/' ? 'index.html' : pathname);

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

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(indexHtml);
  }

  const server = createServer((req, res) => {
    apiMiddleware(req, res, () => {
      serveStatic(req, res).catch((error) => {
        res.statusCode = 500;
        res.end(String(error));
      });
    });
  });

  const shutdown = async () => {
    await apiMiddleware.agent.killCurrent();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Reject on listen errors (EADDRINUSE etc.) — with only the success callback,
  // a taken port left this promise pending forever and the CLI hanging silently.
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, resolve);
  });
}
