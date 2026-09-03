import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import {
  type ApiMiddleware,
  applyCorsHeaders,
  createApiMiddleware,
  handlePreflight,
  hostOf,
  isTrustedHost,
} from '../app/server/api';
import { sendJson } from '../app/server/http';
import {
  type PairingManagerState,
  loadOrMintPairingState,
  machinePairingPath,
  savePairingState,
} from '../app/server/pairing';
import { injectMountAttribute } from '../app/services/mount';
import {
  type MachineProject,
  defaultRegistryPath,
  listProjects,
  loadRegistry,
} from '../core/machine-registry';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { MACHINE_PROJECTS_PATH, type MachineProjectSummary } from '../types/index';
import { formatDevBanner, formatDimNote } from './dev-banner';
import { portInUseMessage } from './dev-port';
import { networkRegistrationLink } from './registration-link';
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

/** No filesystem path in the response — the hub only ever sees projects already
 * registered, never browses a machine's filesystem to find them. */
export async function readMachineProjectSummaries(
  registryPath: string,
): Promise<MachineProjectSummary[]> {
  const registry = await loadRegistry(registryPath);
  return listProjects(registry).map(({ slug, name }) => ({ slug, name }));
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

export function isMachineBusy(mounted: ReadonlyMap<string, ApiMiddleware>): boolean {
  return [...mounted.values()].some((apiMiddleware) => apiMiddleware.agent.hasActiveTask());
}

export async function createProjectApi(
  project: MachineProject,
  pairingState: PairingManagerState,
  onPaired: () => void,
  checkMachineBusy: () => boolean,
): Promise<ApiMiddleware> {
  return createApiMiddleware(
    project.path,
    undefined,
    undefined,
    undefined,
    undefined,
    pairingState,
    onPaired,
    checkMachineBusy,
  );
}

/** Builds and caches a project's API middleware instance on first request — an
 * unopened registered project costs nothing until then. `buildApi` is a seam for
 * tests to avoid spinning up a real project's git/watcher stack. */
export function createProjectMounter(
  registryPath: string,
  buildApi: (project: MachineProject) => Promise<ApiMiddleware>,
  mounted: Map<string, ApiMiddleware> = new Map(),
) {
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
  const mounted = new Map<string, ApiMiddleware>();
  const checkMachineBusy = () => isMachineBusy(mounted);
  const { mount } = createProjectMounter(
    defaultRegistryPath(),
    (project) => createProjectApi(project, pairingState, persistPairing, checkMachineBusy),
    mounted,
  );

  const handleRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);

    if (pathname === MACHINE_PROJECTS_PATH) {
      applyCorsHeaders(req, res);
      if (req.method === 'OPTIONS') {
        handlePreflight(req, res);
        return;
      }
      // Host-trust only, same carve-out as /api/pair: a hosted hub must be able to
      // discover what a reachable machine serves before it has any pairing to lose.
      if (!isTrustedHost(hostOf(req.headers.host))) {
        sendJson(res, 403, { error: 'Forbidden: request failed the Host check' });
        return;
      }
      const projects = await readMachineProjectSummaries(defaultRegistryPath());
      sendJson(res, 200, { projects });
      return;
    }

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

  const color = process.stdout.isTTY === true && !process.env.NO_COLOR;
  console.log(
    formatDevBanner({
      version: PAPER_CAMP_VERSION,
      localUrl: `http://localhost:${port}`,
      networkLink: await networkRegistrationLink(port, pairingState.token),
      color,
    }),
  );
  console.log(
    formatDimNote('Registered projects mount lazily at /p/<slug>/ on first request.', color),
  );
}
