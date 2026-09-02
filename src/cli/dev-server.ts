import { createServer } from 'node:http';
import { createApiMiddleware } from '../app/server/api';
import {
  loadOrMintPairingState,
  projectPairingPath,
  savePairingState,
} from '../app/server/pairing';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { readTailnetStatus } from '../core/tailnet';
import { formatDevBanner, formatShareLine, formatTailnetLine } from './dev-banner';
import { portInUseMessage } from './dev-port';
import { buildRegistrationLinkForRuntime, networkRegistrationLink } from './registration-link';
import { appDir, loadIndexHtml, serveStatic } from './serve-static';
import {
  TAILNET_HTTPS_CERTS_MISSING_MESSAGE,
  TAILNET_NOT_RUNNING_MESSAGE,
  isMissingHttpsCertsError,
  runTailnetServe,
} from './tailnet-serve';
import {
  CLOUDFLARED_MISSING_MESSAGE,
  type QuickTunnel,
  isCloudflaredAvailable,
  startQuickTunnel,
} from './tunnel';

export interface DevServerOptions {
  root: string;
  port: number;
  share?: boolean;
  tailnet?: boolean;
}

/** Serves the pre-built dashboard SPA (dist/app), for an installed package
 * where there's no Vite runtime available (it's a devDependency). */
export async function startDevServer({
  root,
  port,
  share,
  tailnet,
}: DevServerOptions): Promise<void> {
  if (share && !(await isCloudflaredAvailable())) {
    throw new Error(CLOUDFLARED_MISSING_MESSAGE);
  }

  const staticDir = appDir();
  const indexHtml = await loadIndexHtml(staticDir);
  if (indexHtml === null) {
    throw new Error(
      `Dashboard assets not found at ${staticDir}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`,
    );
  }

  const { state: pairingState, minted } = await loadOrMintPairingState(projectPairingPath(root));
  const persistPairingState = () =>
    savePairingState(projectPairingPath(root), pairingState).catch((error) => {
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

  const server = createServer((req, res) => {
    apiMiddleware(req, res, () => {
      serveStatic(req, res, staticDir, indexHtml).catch((error) => {
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
      networkLink: await networkRegistrationLink(port, apiMiddleware.pairing.token),
      color,
    }),
  );

  if (tailnet) {
    const tailnetStatus = await readTailnetStatus();
    if (!tailnetStatus) {
      console.error(TAILNET_NOT_RUNNING_MESSAGE);
    } else {
      const result = await runTailnetServe(port);
      if (result.ok) {
        const tailnetLink = buildRegistrationLinkForRuntime(
          `https://${tailnetStatus.selfDnsName}/`,
          apiMiddleware.pairing.token,
        );
        console.log(formatTailnetLine(tailnetLink, color));
      } else if (isMissingHttpsCertsError(result.output)) {
        console.error(TAILNET_HTTPS_CERTS_MISSING_MESSAGE);
      } else {
        console.error(`papercamp: tailscale serve failed:\n${result.output}`);
      }
    }
  }

  if (share) {
    tunnel = await startQuickTunnel(port);
    const tunnelHost = new URL(tunnel.url).hostname;
    const existing = process.env.PAPERCAMP_ALLOWED_HOSTS;
    process.env.PAPERCAMP_ALLOWED_HOSTS = existing ? `${existing},${tunnelHost}` : tunnelHost;
    const tunnelLink = buildRegistrationLinkForRuntime(tunnel.url, apiMiddleware.pairing.token);
    console.log(formatShareLine(tunnelLink, color));
  }
}
