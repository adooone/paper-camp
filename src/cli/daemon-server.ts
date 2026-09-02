import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { type ApiMiddleware, createApiMiddleware } from '../app/server/api';
import {
  type PairingManagerState,
  loadOrMintPairingState,
  machinePairingPath,
  savePairingState,
} from '../app/server/pairing';
import { injectMountAttribute } from '../app/services/mount';
import { type MachineProject, defaultRegistryPath, loadRegistry } from '../core/machine-registry';
import { portInUseMessage } from './dev-port';
import { appDir, loadIndexHtml, serveStatic } from './serve-static';

export interface DaemonServerOptions {
  port: number;
}

interface MountRequest {
  slug: string;
  rest: string;
}

/** `/p/<slug>` and `/p/<slug>/...` mount a registered project; anything else
 * (bare `/`, the shared JS/CSS bundle) is served unmounted, at the daemon root. */
export function parseMountRequest(pathname: string): MountRequest | null {
  const match = pathname.match(/^\/p\/([^/]+)(\/.*)?$/);
  return match ? { slug: match[1], rest: match[2] ?? '/' } : null;
}

/** Loaded once and passed by reference into every project's middleware, so pairing
 * against any mounted project pairs the hub to all of them. */
async function loadMachinePairing(): Promise<{
  state: PairingManagerState;
  persist: () => void;
}> {
  const path = machinePairingPath();
  const { state, minted } = await loadOrMintPairingState(path);
  const persist = () =>
    savePairingState(path, state).catch((error) => {
      console.error('paper-camp: could not persist machine pairing state:', error);
    });
  if (minted) await persist();
  return { state, persist };
}

export async function createProjectApi(
  project: MachineProject,
  pairingState: PairingManagerState,
  onPaired: () => void,
): Promise<ApiMiddleware> {
  return createApiMiddleware(
    project.path,
    undefined,
    undefined,
    undefined,
    undefined,
    pairingState,
    onPaired,
  );
}

/** Builds and caches a project's API middleware instance on first request — an
 * unopened registered project costs nothing until then. `buildApi` is a seam for
 * tests to avoid spinning up a real project's git/watcher stack. */
export function createProjectMounter(
  registryPath: string,
  buildApi: (project: MachineProject) => Promise<ApiMiddleware>,
) {
  const mounted = new Map<string, ApiMiddleware>();

  async function mount(slug: string): Promise<ApiMiddleware | null> {
    const cached = mounted.get(slug);
    if (cached) return cached;

    const registry = await loadRegistry(registryPath);
    const project = registry.projects.find((p) => p.slug === slug);
    if (!project) return null;

    const apiMiddleware = await buildApi(project);
    mounted.set(slug, apiMiddleware);
    console.log(`paper-camp: mounted "${slug}" (${project.path})`);
    return apiMiddleware;
  }

  return { mount, mounted };
}

export async function startDaemonServer({ port }: DaemonServerOptions): Promise<void> {
  const staticDir = appDir();
  const indexHtml = await loadIndexHtml(staticDir);
  if (indexHtml === null) {
    throw new Error(
      `Dashboard assets not found at ${staticDir}. Run \`pnpm build\` (or reinstall the package) so dist/app exists.`,
    );
  }

  const { state: pairingState, persist: persistPairing } = await loadMachinePairing();
  const { mount, mounted } = createProjectMounter(defaultRegistryPath(), (project) =>
    createProjectApi(project, pairingState, persistPairing),
  );

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const request = parseMountRequest(pathname);
    if (!request) {
      await serveStatic(req, res, staticDir, indexHtml);
      return;
    }

    const apiMiddleware = await mount(request.slug);
    if (!apiMiddleware) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(`paper-camp daemon: no registered project with slug "${request.slug}"`);
      return;
    }

    const query = (req.url ?? '').split('?')[1];
    req.url = query ? `${request.rest}?${query}` : request.rest;

    const mountedIndexHtml = injectMountAttribute(indexHtml, `/p/${request.slug}`);
    await apiMiddleware(req, res, () => {
      serveStatic(req, res, staticDir, mountedIndexHtml).catch((error) => {
        res.statusCode = 500;
        res.end(String(error));
      });
    });
  };

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });

  const shutdown = async () => {
    await Promise.all(
      [...mounted.values()].map(async (apiMiddleware) => {
        await apiMiddleware.agent.killCurrent();
        await apiMiddleware.services.killAll();
      }),
    );
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new Error(portInUseMessage(port)) : error);
    });
    server.listen(port, resolve);
  });

  console.log(`paper-camp daemon listening on http://localhost:${port}`);
  console.log('Registered projects mount lazily at /p/<slug>/ on first request.');
}
