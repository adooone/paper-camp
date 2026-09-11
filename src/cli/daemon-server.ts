import { readFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import { join } from 'node:path';
import {
  type ApiMiddleware,
  applyCorsHeaders,
  createApiMiddleware,
  handlePreflight,
  hostOf,
  isLoopbackHost,
  isTrustedHost,
} from '../app/server/api';
import { readBody, sendJson } from '../app/server/http';
import {
  type PairingManagerState,
  loadOrMintPairingState,
  machinePairingPath,
  savePairingState,
} from '../app/server/pairing';
import {
  type DaemonState,
  type UpdateEvent,
  daemonLogPath,
  daemonStatePath,
  removeDaemonState,
  writeDaemonState,
} from '../core/daemon-state';
import {
  type MachineProject,
  defaultRegistryPath,
  isProjectMissing,
  listProjects,
  loadRegistry,
} from '../core/machine-registry';
import { evaluateNightGate } from '../core/night-gate';
import { computeNightHealthMap } from '../core/night-health';
import { startNightShift } from '../core/night-shift';
import { readTaskLog } from '../core/parse';
import { latestCapacity } from '../core/rate-limit';
import { checkLatestVersion } from '../core/registry-version';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { readTailnetStatus } from '../core/tailnet';
import { loadOrMintUpdateToken, updateTokenPath } from '../core/update-token';
import {
  MACHINE_NIGHT_PATH,
  MACHINE_PROJECTS_PATH,
  MACHINE_UPDATE_PATH,
  type MachineNightGateResponse,
  type MachineProjectSummary,
  type MachineUpdateRequest,
  type MachineUpdateResponse,
} from '../types/index';
import {
  type InstallResult,
  applyMachineUpdate,
  checkForUpdateAtBoot,
  installedVersionAt,
  runNpmInstall,
  spawnRestart,
} from './auto-update';
import { formatDevBanner } from './dev-banner';
import { portInUseMessage } from './dev-port';
import { readNightConfig, resolveNightConfig, runNightPass } from './night-command';
import {
  type NetworkRegistration,
  buildRegistrationLinkForMachine,
  networkRegistrationLink,
} from './registration-link';
import {
  TAILNET_NOT_RUNNING_MESSAGE,
  runTailnetServe,
  tailnetFailureMessage,
} from './tailnet-serve';
import { isToolbarAssetRequest, serveToolbarAsset } from './toolbar-assets';
import {
  CLOUDFLARED_MISSING_MESSAGE,
  type QuickTunnel,
  isCloudflaredAvailable,
  startQuickTunnel,
} from './tunnel';

export const DEFAULT_DAEMON_PORT = 4333;

export interface DaemonServerOptions {
  port: number;
  share?: boolean;
  tailnet?: boolean;
}

interface MountRequest {
  slug: string;
  rest: string;
}

/** `/p/<slug>` and `/p/<slug>/...` mount a registered project; anything else
 * (bare `/`, `/api/machine/projects`) is handled unmounted, at the daemon root. */
export function parseMountRequest(pathname: string): MountRequest | null {
  const match = pathname.match(/^\/p\/([^/]+)(\/.*)?$/);
  return match ? { slug: match[1], rest: match[2] ?? '/' } : null;
}

/** No filesystem path in the response — the hub only ever sees projects already
 * registered, never browses a machine's filesystem to find them. */
export async function readMachineProjectSummaries(
  registryPath: string,
  mounted: ReadonlyMap<string, ApiMiddleware>,
): Promise<MachineProjectSummary[]> {
  const registry = await loadRegistry(registryPath);
  return Promise.all(
    listProjects(registry).map(async ({ slug, name, path }) => {
      const apiMiddleware = mounted.get(slug);
      return {
        slug,
        name,
        mounted: apiMiddleware !== undefined,
        busy: apiMiddleware?.agent.hasActiveTask() ?? false,
        missing: await isProjectMissing(path),
        interruptedCount: apiMiddleware?.agent.getInterruptedOnBoot(),
      };
    }),
  );
}

export async function buildNightGateResponse(
  registryPath: string,
  mounted: ReadonlyMap<string, ApiMiddleware>,
  now: number = Date.now(),
): Promise<MachineNightGateResponse> {
  const registry = await loadRegistry(registryPath);
  if (!registry.night) return { slug: null, projectMissing: false, pausedUntil: null, gate: null };

  const slug = registry.night.slug;
  const pausedUntil = registry.night.pausedUntil ?? null;
  const project = registry.projects.find((p) => p.slug === slug);
  if (!project || (await isProjectMissing(project.path))) {
    return { slug, projectMissing: true, pausedUntil, gate: null };
  }

  const nightConfig = await readNightConfig(project.path);
  const resolved = resolveNightConfig(nightConfig);
  const apiMiddleware = mounted.get(slug);
  const taskLogRaw = await readFile(join(project.path, 'papercamp', 'tasks.log'), 'utf-8').catch(
    () => '',
  );
  const snapshot = latestCapacity(readTaskLog(taskLogRaw))?.snapshot ?? null;

  const gate = evaluateNightGate({
    now,
    lastDashboardRequestAt: apiMiddleware?.getLastRequestAt() ?? null,
    taskRunning: apiMiddleware?.agent.hasActiveTask() ?? false,
    snapshot,
    ceiling: resolved.ceiling,
    floor: resolved.floor,
    window: resolved.window,
    pausedUntil,
  });

  return { slug, projectMissing: false, pausedUntil, gate };
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

export type MountResult =
  | { kind: 'mounted'; api: ApiMiddleware }
  | { kind: 'unknown' }
  | { kind: 'missing'; path: string };

/** Builds and caches a project's API middleware instance on first request — an
 * unopened registered project costs nothing until then. `buildApi` is a seam for
 * tests to avoid spinning up a real project's git/watcher stack. */
export function createProjectMounter(
  registryPath: string,
  buildApi: (project: MachineProject) => Promise<ApiMiddleware>,
  mounted: Map<string, ApiMiddleware> = new Map(),
) {
  async function mount(slug: string): Promise<MountResult> {
    const registry = await loadRegistry(registryPath);
    const project = registry.projects.find((p) => p.slug === slug);
    if (!project) return { kind: 'unknown' };

    // Checked on every request, cached or not: a folder deleted after its mount
    // must stop serving an empty desk, and a restored one must mount fresh.
    if (await isProjectMissing(project.path)) {
      const stale = mounted.get(slug);
      if (stale) {
        mounted.delete(slug);
        await stale.agent.killCurrent();
        await stale.services.killAll();
      }
      return { kind: 'missing', path: project.path };
    }

    const cached = mounted.get(slug);
    if (cached) return { kind: 'mounted', api: cached };

    const apiMiddleware = await buildApi(project);
    mounted.set(slug, apiMiddleware);
    console.log(`paper-camp: mounted "${slug}" (${project.path})`);
    return { kind: 'mounted', api: apiMiddleware };
  }

  return { mount, mounted };
}

const IDLE_RESTART_POLL_MS = 5_000;

/** Watches only this daemon's own busy flag — no network calls — so a restart
 *  held for a busy machine still fires once idle, now that no registry-poll
 *  timer is left to retry it (IDEA-258). */
export function watchForIdleRestart(isBusy: () => boolean, restart: () => void): () => void {
  const timer = setInterval(() => {
    if (isBusy()) return;
    clearInterval(timer);
    restart();
  }, IDLE_RESTART_POLL_MS);
  return () => clearInterval(timer);
}

export interface UpdateApplierDeps {
  runInstall: (version: string) => Promise<InstallResult>;
  installedVersion: () => Promise<string | null>;
  restart: () => void;
}

/** One instance lives for the daemon's whole run, so a restart held for a busy
 *  machine on one call is superseded rather than duplicated if another caller —
 *  the boot check or a later hook — asks again before the machine goes idle. */
export function createUpdateApplier(
  isBusy: () => boolean,
  deps: UpdateApplierDeps,
): (version: string) => Promise<MachineUpdateResponse> {
  let stopIdleWatch: (() => void) | undefined;

  return async (version) => {
    stopIdleWatch?.();
    stopIdleWatch = undefined;
    const result = await applyMachineUpdate(version, { ...deps, isBusy });
    if (result.outcome === 'waiting for idle') {
      stopIdleWatch = watchForIdleRestart(isBusy, deps.restart);
    }
    return result;
  };
}

export type UpdateSource = 'hooked' | 'boot check';

/** What `status` shows next, given the previous event and one apply outcome.
 *  A hold for idle keeps the previous event, since the pending version takes
 *  over the status line until it resolves; a boot check that found and
 *  installed something newer leaves the event alone too, since the restart
 *  moments away will boot fresh and check again. */
export function deriveUpdateEvent(
  previous: UpdateEvent | undefined,
  source: UpdateSource,
  version: string,
  result: MachineUpdateResponse,
): UpdateEvent | undefined {
  if (result.outcome === 'waiting for idle') return previous;
  if (result.outcome === 'failed') return { kind: 'failed', version, output: result.output ?? '' };
  if (source === 'hooked') return { kind: 'hooked', version, at: new Date().toISOString() };
  if (result.outcome === 'already current') return { kind: 'boot check current' };
  return previous;
}

export function createMachineUpdateHandler(
  updateToken: string,
  applyUpdate: (version: string) => Promise<MachineUpdateResponse>,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!bearer || bearer !== updateToken) {
      sendJson(res, 403, { error: 'Forbidden: invalid update token' });
      return;
    }

    let body: MachineUpdateRequest;
    try {
      body = JSON.parse(await readBody(req)) as MachineUpdateRequest;
    } catch {
      sendJson(res, 400, { error: 'Malformed JSON body' });
      return;
    }
    if (!body.version) {
      sendJson(res, 400, { error: '"version" is required' });
      return;
    }

    sendJson(res, 200, await applyUpdate(body.version));
  };
}

/** The daemon's routing decision, isolated from `startDaemonServer`'s process
 * lifecycle (signal handlers, tunnel, tailnet) so it can be driven by a real
 * `http.Server` in tests without spinning any of that up. */
export function createDaemonRequestHandler(
  registryPath: string,
  mount: (slug: string) => Promise<MountResult>,
  mounted: ReadonlyMap<string, ApiMiddleware>,
  localLink: string,
  getPendingUpdateVersion: () => string | null = () => null,
  // A seam for tests to serve a fake toolbar bundle without a real dist/toolbar on disk.
  serveToolbar: (req: IncomingMessage, res: ServerResponse) => Promise<boolean> = serveToolbarAsset,
  handleMachineUpdate: (req: IncomingMessage, res: ServerResponse) => Promise<void> = async (
    _req,
    res,
  ) => sendJson(res, 403, { error: 'Forbidden: invalid update token' }),
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);

    // localLink only resolves for loopback — gating it here keeps the pairing token
    // out of a LAN/tunnel peer's reach instead of handing it out via Location.
    if (pathname === '/' && isLoopbackHost(hostOf(req.headers.host))) {
      res.statusCode = 302;
      res.setHeader('Location', localLink);
      res.end();
      return;
    }

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
      const projects = await readMachineProjectSummaries(registryPath, mounted);
      sendJson(res, 200, { projects, pendingUpdateVersion: getPendingUpdateVersion() });
      return;
    }

    if (pathname === MACHINE_NIGHT_PATH) {
      applyCorsHeaders(req, res);
      if (req.method === 'OPTIONS') {
        handlePreflight(req, res);
        return;
      }
      if (!isTrustedHost(hostOf(req.headers.host))) {
        sendJson(res, 403, { error: 'Forbidden: request failed the Host check' });
        return;
      }
      sendJson(res, 200, await buildNightGateResponse(registryPath, mounted));
      return;
    }

    if (pathname === MACHINE_UPDATE_PATH) {
      // No CORS/pairing carve-out here, unlike the two routes above: this call comes
      // from the Publish workflow's curl on the tailnet, never a browser.
      if (!isTrustedHost(hostOf(req.headers.host))) {
        sendJson(res, 403, { error: 'Forbidden: request failed the Host check' });
        return;
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST required' });
        return;
      }
      await handleMachineUpdate(req, res);
      return;
    }

    const request = parseMountRequest(pathname);
    if (!request) {
      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'no project mounted at the daemon root' });
        return;
      }
      res.statusCode = 404;
      res.end();
      return;
    }

    const result = await mount(request.slug);
    if (result.kind !== 'mounted') {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end(
        result.kind === 'missing'
          ? `paper-camp daemon: project folder missing at ${result.path}`
          : `paper-camp daemon: no registered project with slug "${request.slug}"`,
      );
      return;
    }
    const apiMiddleware = result.api;

    const query = (req.url ?? '').split('?')[1];
    req.url = query ? `${request.rest}?${query}` : request.rest;

    if (isToolbarAssetRequest(req)) {
      // A host app's Vite dev server has its own loopback origin, so the injected
      // script's requests back to the daemon need CORS even though both are local.
      let originHost = '';
      try {
        originHost = req.headers.origin ? hostOf(new URL(req.headers.origin).host) : '';
      } catch {}
      if (isLoopbackHost(originHost)) {
        applyCorsHeaders(req, res);
        if (req.method === 'OPTIONS') {
          handlePreflight(req, res);
          return;
        }
      }
      if (await serveToolbar(req, res)) return;
    }

    await apiMiddleware(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  };
}

/** The HTTPS remedy is for a run without one — with `--tailnet` or `--share`
 * asked for, its own line reports the outcome instead. */
export function withRequestedNetwork(
  network: NetworkRegistration,
  requested: boolean,
): NetworkRegistration {
  return requested ? { ...network, blocked: false } : network;
}

export function formatDaemonBanner(
  localLink: string,
  network: NetworkRegistration,
  tailnetLink: string | undefined,
  tunnelLink: string | undefined,
  color: boolean,
): string {
  return formatDevBanner({
    version: PAPER_CAMP_VERSION,
    localUrl: localLink,
    networkLink: network.link,
    networkBlocked: network.blocked,
    tailnetLink,
    tunnelLink,
    color,
  });
}

export async function startDaemonServer({
  port,
  share,
  tailnet,
}: DaemonServerOptions): Promise<void> {
  if (share && !(await isCloudflaredAvailable())) {
    throw new Error(CLOUDFLARED_MISSING_MESSAGE);
  }

  const { state: pairingState, persist: persistPairing } = await loadMachinePairing();
  const updateToken = await loadOrMintUpdateToken(updateTokenPath());
  const mounted = new Map<string, ApiMiddleware>();
  const checkMachineBusy = () => isMachineBusy(mounted);
  let pendingUpdateVersion: string | null = null;
  const { mount } = createProjectMounter(
    defaultRegistryPath(),
    (project) => createProjectApi(project, pairingState, persistPairing, checkMachineBusy),
    mounted,
  );

  const statePath = daemonStatePath();
  let daemonState: DaemonState = {
    pid: process.pid,
    port,
    version: PAPER_CAMP_VERSION,
    startedAt: new Date().toISOString(),
    share: share ?? false,
    tailnet: tailnet ?? false,
  };

  const recordUpdateOutcome = async (
    source: UpdateSource,
    version: string,
    result: MachineUpdateResponse,
  ): Promise<void> => {
    const pending = result.outcome === 'waiting for idle' ? version : null;
    pendingUpdateVersion = pending;
    daemonState = {
      ...daemonState,
      updateEvent: deriveUpdateEvent(daemonState.updateEvent, source, version, result),
      updatePendingVersion: pending,
    };
    await writeDaemonState(statePath, daemonState);
  };

  const applyUpdate = createUpdateApplier(checkMachineBusy, {
    runInstall: runNpmInstall,
    installedVersion: () => installedVersionAt(process.argv[1]),
    restart: () => spawnRestart(process.argv[1], daemonLogPath()),
  });
  const handleMachineUpdate = createMachineUpdateHandler(updateToken, async (version) => {
    const result = await applyUpdate(version);
    await recordUpdateOutcome('hooked', version, result);
    return result;
  });

  const localLink = buildRegistrationLinkForMachine(`http://localhost:${port}`, pairingState.token);
  const handleRequest = createDaemonRequestHandler(
    defaultRegistryPath(),
    mount,
    mounted,
    localLink,
    () => pendingUpdateVersion,
    undefined,
    handleMachineUpdate,
  );

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      res.statusCode = 500;
      res.end(String(error));
    });
  });

  let tunnel: QuickTunnel | undefined;
  const stopNightShift = startNightShift({
    evaluateGate: () => buildNightGateResponse(defaultRegistryPath(), mounted),
    findProject: async (slug) => {
      const registry = await loadRegistry(defaultRegistryPath());
      return registry.projects.find((project) => project.slug === slug) ?? null;
    },
    readSettings: async (root) => resolveNightConfig(await readNightConfig(root)),
    computeMap: computeNightHealthMap,
    runPass: (project, chunkPath) =>
      runNightPass(project, chunkPath, async () => {
        const gate = await buildNightGateResponse(defaultRegistryPath(), mounted);
        return Boolean(gate.gate?.open) && !checkMachineBusy();
      }),
    isMachineBusy: checkMachineBusy,
  });
  const shutdown = async () => {
    stopNightShift();
    tunnel?.process.kill();
    await Promise.all(
      [...mounted.values()].map(async (apiMiddleware) => {
        await apiMiddleware.agent.killCurrent();
        await apiMiddleware.services.killAll();
      }),
    );
    await removeDaemonState(statePath);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await new Promise<void>((resolve, reject) => {
    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error.code === 'EADDRINUSE' ? new Error(portInUseMessage(port, 'daemon')) : error);
    });
    server.listen(port, resolve);
  });

  const color = process.stdout.isTTY === true && !process.env.NO_COLOR;

  let tailnetLink: string | undefined;
  if (tailnet) {
    const tailnetStatus = await readTailnetStatus();
    if (!tailnetStatus) {
      console.error(`papercamp: Tailnet failed — ${TAILNET_NOT_RUNNING_MESSAGE}`);
    } else {
      const result = await runTailnetServe(port);
      if (result.ok) {
        tailnetLink = buildRegistrationLinkForMachine(
          `https://${tailnetStatus.selfDnsName}/`,
          pairingState.token,
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
    tunnelLink = buildRegistrationLinkForMachine(tunnel.url, pairingState.token);
  }

  const network = await networkRegistrationLink(
    port,
    pairingState.token,
    buildRegistrationLinkForMachine,
  );

  daemonState = {
    ...daemonState,
    links: {
      host: localLink,
      network: network.link,
      tailnet: tailnetLink,
      tunnel: tunnelLink,
    },
  };
  await writeDaemonState(statePath, daemonState);

  void checkForUpdateAtBoot(PAPER_CAMP_VERSION, checkLatestVersion, applyUpdate).then((check) =>
    recordUpdateOutcome(
      'boot check',
      check.newerFound ? check.version : PAPER_CAMP_VERSION,
      check.newerFound ? check.result : { outcome: 'already current' },
    ),
  );

  console.log(
    formatDaemonBanner(
      localLink,
      withRequestedNetwork(network, Boolean(tailnet || share)),
      tailnetLink,
      tunnelLink,
      color,
    ),
  );
}
