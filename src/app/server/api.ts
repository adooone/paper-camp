import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostname } from 'node:os';
import { createActivityManager } from './activity';
import { type AgentManager, type AgentManagerState, createAgentManager } from './agent';
import { createAgentHooks } from './agent-hooks';
import {
  type DeskCheckManager,
  type DeskCheckManagerState,
  createDeskCheckManager,
} from './desk-checks';
import {
  type DeskServiceManager,
  type DeskServiceManagerState,
  createDeskServiceManager,
} from './desk-services';
import { createGitManager } from './git';
import { sendJson } from './http';
import { type PairingManager, type PairingManagerState, createPairingManager } from './pairing';
import { buildRoutes, readRoutes } from './routes/index';
import { type StatusManagerState, createStatusManager } from './status';

export interface ApiMiddleware {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  agent: AgentManager;
  services: DeskServiceManager;
  checks: DeskCheckManager;
  pairing: PairingManager;
  getStatusState: () => StatusManagerState;
  getServiceState: () => DeskServiceManagerState;
  getCheckState: () => DeskCheckManagerState;
  getPairingState: () => PairingManagerState;
}

// Trusted because a DNS-rebinding attacker controls their own public domain,
// never the victim's real hostname, so accepting it can't widen the rebinding surface.
const SELF_HOSTNAMES = new Set(
  (() => {
    try {
      const h = hostname().toLowerCase();
      return [h, h.split('.')[0]];
    } catch {
      return [];
    }
  })(),
);

function hostOf(value: string | undefined): string {
  if (!value) return '';
  const h = value.trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']')); // [::1]:3333
  return h.split(':')[0];
}

// Reaching loopback proves the caller is a process on this machine, the one
// case a missing Origin can still stand in for the pairing token.
function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

export const PAIRING_TOKEN_HEADER = 'x-pairing-token' as const;

/** Hosts that actually point at this machine — loopback, private LAN, Tailscale/mDNS,
 *  or PAPERCAMP_ALLOWED_HOSTS. This API runs git and launches auto-permission agents,
 *  so anything else is rejected to block DNS-rebinding. */
export function isTrustedHost(host: string): boolean {
  if (!host) return false;
  if (isLoopbackHost(host)) return true;
  if (SELF_HOSTNAMES.has(host)) return true;
  if (host.endsWith('.ts.net') || host.endsWith('.local')) return true; // Tailscale / mDNS
  const extra = process.env.PAPERCAMP_ALLOWED_HOSTS;
  if (
    extra
      ?.split(',')
      .map((s) => s.trim().toLowerCase())
      .includes(host)
  ) {
    return true;
  }
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    return (
      a === 10 || // 10.0.0.0/8
      a === 127 || // loopback
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 100 && b >= 64 && b <= 127) // Tailscale CGNAT 100.64.0.0/10
    );
  }
  return false;
}

/** Blocks DNS-rebinding (foreign Host) and cross-origin reads/writes alike (foreign
 *  Origin). Once any hosted page can attempt a loopback request, "arrived from
 *  loopback" stops being evidence the caller is the user's own client — so a
 *  paired origin (established via /api/pair's shared token) is trusted the same
 *  as a LAN/Tailscale one. Browsers omit Origin on a same-origin GET, but they
 *  can't fake the Host they're actually addressing — a non-loopback trusted Host
 *  (LAN, Tailscale, a shared tunnel) is reachable by curl too, so a request that
 *  carries neither Origin nor the pairing token is treated as one of those.
 *  Returns true if the request should be rejected. */
export function isForbiddenRequest(
  req: {
    headers: { host?: string; origin?: string; [PAIRING_TOKEN_HEADER]?: string };
    method?: string;
  },
  isPairedOrigin: (origin: string) => boolean = () => false,
  pairingToken?: string,
): boolean {
  const host = hostOf(req.headers.host);
  if (!isTrustedHost(host)) return true;
  const origin = req.headers.origin;
  if (origin) {
    let originHost = 'invalid';
    try {
      originHost = hostOf(new URL(origin).host);
    } catch {}
    return !isTrustedHost(originHost) && !isPairedOrigin(origin);
  }
  if (isLoopbackHost(host)) return false;
  const token = req.headers[PAIRING_TOKEN_HEADER];
  return !pairingToken || token !== pairingToken;
}

const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

/** Lets a hosted https client read /api responses. Reflects the request's own
 *  Origin rather than `*` (incompatible with credentials) or a fixed value (there's
 *  no known client origin yet — that arrives with pairing). This only affects what
 *  JS may read; isForbiddenRequest above still gates which requests are answered. */
export function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}

/** Answers the CORS/Private Network Access preflight Chrome sends before a public
 *  page may fetch a private-network address like localhost — without an explicit
 *  Access-Control-Allow-Private-Network, the browser refuses the real request. */
export function handlePreflight(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS);
  const requestHeaders = req.headers['access-control-request-headers'];
  if (requestHeaders) res.setHeader('Access-Control-Allow-Headers', requestHeaders);
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  res.statusCode = 204;
  res.end();
}

export function createApiMiddleware(
  root: string,
  agentState?: AgentManagerState,
  statusState?: StatusManagerState,
  serviceState?: DeskServiceManagerState,
  checkState?: DeskCheckManagerState,
  pairingState?: PairingManagerState,
): ApiMiddleware {
  const git = createGitManager(root);
  const status = createStatusManager(root, statusState);
  const services = createDeskServiceManager(root, serviceState);
  const checks = createDeskCheckManager(root, checkState);
  const pairing = createPairingManager(pairingState);
  const hooks = createAgentHooks(root, git);
  const agent = createAgentManager(
    root,
    hooks.stampAuditDate,
    hooks.commitPhase,
    hooks.setRunReview,
    hooks.commitCorpus,
    hooks.annotateFixRun,
    hooks.snapshotWorkingTree,
    agentState,
  );
  const activity = createActivityManager(root);

  const routes = buildRoutes({ root, activity, agent, git, status, services, checks, pairing });

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url ?? '').split('?')[0];

    // Only guard our own /api surface — static assets / Vite HMR fall through to
    // next() untouched so the SPA still loads from any interface.
    if (pathname.startsWith('/api/')) {
      applyCorsHeaders(req, res);
      // The preflight itself carries no credentials and changes nothing, so it's
      // answered before the Host/Origin gate — otherwise an unpaired origin could
      // never get far enough to call /api/pair and prove it's the user's client.
      if (req.method === 'OPTIONS') {
        handlePreflight(req, res);
        return;
      }
      // /api/pair is how a not-yet-trusted origin becomes trusted, so it can't
      // require Origin trust itself — only that the caller reached a real Host.
      // Its own token check is what stands in for the Origin gate here.
      const forbidden =
        pathname === '/api/pair'
          ? !isTrustedHost(hostOf(req.headers.host))
          : isForbiddenRequest(req, pairing.isPairedOrigin, pairing.token);
      if (forbidden) {
        sendJson(res, 403, { error: 'Forbidden: request failed the Host/Origin check' });
        return;
      }
    }

    const route = routes.find((r) => r.method === req.method && r.path === pathname);
    if (route) {
      try {
        await route.handle(req, res);
      } catch (error) {
        sendJson(res, 500, { error: (error as Error).message });
      }
      return;
    }

    const read = readRoutes.find((r) => r.path === pathname);
    if (!read) {
      next();
      return;
    }
    try {
      sendJson(res, 200, await read.handler(root));
    } catch (error) {
      sendJson(res, 500, { error: (error as Error).message });
    }
  };

  (handler as ApiMiddleware).agent = agent;
  (handler as ApiMiddleware).services = services;
  (handler as ApiMiddleware).checks = checks;
  (handler as ApiMiddleware).pairing = pairing;
  (handler as ApiMiddleware).getStatusState = status.getState;
  (handler as ApiMiddleware).getServiceState = services.getState;
  (handler as ApiMiddleware).getCheckState = checks.getState;
  (handler as ApiMiddleware).getPairingState = pairing.getState;
  return handler as ApiMiddleware;
}
