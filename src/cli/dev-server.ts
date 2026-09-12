import { createServer } from 'node:http';
import { createApiMiddleware, hostOf, isLoopbackHost } from '../app/server/api';
import {
  loadOrMintPairingState,
  projectPairingPath,
  savePairingState,
} from '../app/server/pairing';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { readTailnetStatus } from '../core/tailnet';
import { formatDevBanner } from './dev-banner';
import { portInUseMessage } from './dev-port';
import { buildRegistrationLinkForRuntime, networkRegistrationLink } from './registration-link';
import {
  TAILNET_NOT_RUNNING_MESSAGE,
  runTailnetServe,
  tailnetFailureMessage,
} from './tailnet-serve';
import { serveToolbarAsset } from './toolbar-assets';
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

/** Serves the API and the toolbar bundle a host app's Vite plugin proxies to; the
 * dashboard itself is the hosted client, opened at the Local link this banner prints. */
export async function startDevServer({
  root,
  port,
  share,
  tailnet,
}: DevServerOptions): Promise<void> {
  if (share && !(await isCloudflaredAvailable())) {
    throw new Error(CLOUDFLARED_MISSING_MESSAGE);
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

  const localLink = buildRegistrationLinkForRuntime(
    `http://localhost:${port}`,
    apiMiddleware.pairing.token,
  );

  const server = createServer((req, res) => {
    apiMiddleware(req, res, async () => {
      try {
        // The link always points at localhost, so it only resolves correctly for a
        // request that already arrived over loopback — anything else falls through to 404.
        if ((req.url ?? '/').split('?')[0] === '/' && isLoopbackHost(hostOf(req.headers.host))) {
          res.statusCode = 302;
          res.setHeader('Location', localLink);
          res.end();
          return;
        }
        if (await serveToolbarAsset(req, res)) return;
        res.statusCode = 404;
        res.end();
      } catch (error) {
        res.statusCode = 500;
        res.end(String(error));
      }
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

  const tty = process.stdout.isTTY === true;
  const color = tty && !process.env.NO_COLOR;
  const network = await networkRegistrationLink(port, apiMiddleware.pairing.token);

  let tailnetLink: string | undefined;
  if (tailnet) {
    const tailnetStatus = await readTailnetStatus();
    if (!tailnetStatus) {
      console.error(`papercamp: Tailnet failed — ${TAILNET_NOT_RUNNING_MESSAGE}`);
    } else {
      const result = await runTailnetServe(port);
      if (result.ok) {
        tailnetLink = buildRegistrationLinkForRuntime(
          `https://${tailnetStatus.selfDnsName}/`,
          apiMiddleware.pairing.token,
        );
      } else {
        console.error(tailnetFailureMessage(result.output));
      }
    }
  }

  let tunnelLink: string | undefined;
  if (share) {
    tunnel = await startQuickTunnel(port);
    const tunnelHost = new URL(tunnel.url).hostname;
    const existing = process.env.PAPERCAMP_ALLOWED_HOSTS;
    process.env.PAPERCAMP_ALLOWED_HOSTS = existing ? `${existing},${tunnelHost}` : tunnelHost;
    tunnelLink = buildRegistrationLinkForRuntime(tunnel.url, apiMiddleware.pairing.token);
  }

  console.log(
    formatDevBanner({
      version: PAPER_CAMP_VERSION,
      localUrl: localLink,
      networkLink: network.link,
      networkBlocked: network.blocked && !tailnet && !share,
      tailnetLink,
      tunnelLink,
      color,
      tty,
    }),
  );
}
