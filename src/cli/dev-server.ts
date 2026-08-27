import { readFile, stat } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { dirname, extname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from '../app/server/api';
import { loadOrMintPairingState, savePairingState } from '../app/server/pairing';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { formatDevBanner, formatShareLine } from './dev-banner';
import { portInUseMessage } from './dev-port';
import { buildRegistrationLinkForRuntime, networkRegistrationLink } from './registration-link';
import {
  CLOUDFLARED_MISSING_MESSAGE,
  type QuickTunnel,
  isCloudflaredAvailable,
  startQuickTunnel,
} from './tunnel';

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
  share?: boolean;
}

/** Serves the pre-built dashboard SPA (dist/app), for an installed package
 * where there's no Vite runtime available (it's a devDependency). */
export async function startDevServer({ root, port, share }: DevServerOptions): Promise<void> {
  if (share && !(await isCloudflaredAvailable())) {
    throw new Error(CLOUDFLARED_MISSING_MESSAGE);
  }

  const staticDir = appDir();
  const indexPath = join(staticDir, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf-8').catch(() => null);
  if (indexHtml === null) {
    throw new Error(
      `Dashboard assets not found at ${staticDir}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`,
    );
  }

  const { state: pairingState, minted } = await loadOrMintPairingState(root);
  const persistPairingState = () =>
    savePairingState(root, pairingState).catch((error) => {
      console.error('papercamp: could not persist pairing state:', error);
    });

  const apiMiddleware = createApiMiddleware(
    root,
    undefined,
    undefined,
    undefined,
    undefined,
    pairingState,
    () => persistPairingState(),
  );

  if (minted) await persistPairingState();

  async function serveStatic(req: IncomingMessage, res: ServerResponse) {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const filePath = join(staticDir, pathname === '/' ? 'index.html' : pathname);

    // join() normalizes `..`, so a crafted path like /../../.env would otherwise
    // escape staticDir and serve arbitrary files; treat it as the SPA fallback instead.
    const escapesStaticDir = filePath !== staticDir && !filePath.startsWith(staticDir + sep);

    // Prevent browsers from heuristically caching stale bundles across rebuilds.
    res.setHeader('Cache-Control', 'no-cache');

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

  let tunnel: QuickTunnel | undefined;
  const shutdown = async () => {
    tunnel?.process.kill();
    await apiMiddleware.agent.killCurrent();
    await apiMiddleware.services.killAll();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Reject on listen errors (EADDRINUSE etc.) — with only the success callback,
  // a taken port left this promise pending forever and the CLI hanging silently.
  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new Error(portInUseMessage(port)) : error);
    });
    server.listen(port, resolve);
  });

  const color = process.stdout.isTTY === true && !process.env.NO_COLOR;
  console.log(
    formatDevBanner({
      version: PAPER_CAMP_VERSION,
      localUrl: `http://localhost:${port}`,
      networkLink: networkRegistrationLink(port, apiMiddleware.pairing.token),
      color,
    }),
  );

  if (share) {
    tunnel = await startQuickTunnel(port);
    const tunnelHost = new URL(tunnel.url).hostname;
    const existing = process.env.PAPERCAMP_ALLOWED_HOSTS;
    process.env.PAPERCAMP_ALLOWED_HOSTS = existing ? `${existing},${tunnelHost}` : tunnelHost;
    const tunnelLink = buildRegistrationLinkForRuntime(tunnel.url, apiMiddleware.pairing.token);
    console.log(formatShareLine(tunnelLink, color));
  }
}
