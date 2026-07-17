import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostname } from 'node:os';
import { createActivityManager } from './activity';
import { type AgentManager, createAgentManager } from './agent';
import { createAgentHooks } from './agent-hooks';
import { createGitManager } from './git';
import { sendJson } from './http';
import { buildRoutes, readRoutes } from './routes/index';
import { createStatusManager } from './status';

export interface ApiMiddleware {
  (req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void>;
  agent: AgentManager;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

/** Hosts that actually point at this machine — loopback, private LAN, Tailscale/mDNS,
 *  or PAPERCAMP_ALLOWED_HOSTS. This API runs git and launches auto-permission agents,
 *  so anything else is rejected to block DNS-rebinding. */
export function isTrustedHost(host: string): boolean {
  if (!host) return false;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
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

/** Blocks DNS-rebinding (foreign Host) and cross-site CSRF (foreign Origin on a
 *  state-changing call). Returns true if the request should be rejected. */
export function isForbiddenRequest(req: {
  headers: { host?: string; origin?: string };
  method?: string;
}): boolean {
  if (!isTrustedHost(hostOf(req.headers.host))) return true;
  if (MUTATING_METHODS.has(req.method ?? '')) {
    const origin = req.headers.origin;
    if (origin) {
      let originHost = 'invalid';
      try {
        originHost = hostOf(new URL(origin).host);
      } catch {}
      if (!isTrustedHost(originHost)) return true;
    }
  }
  return false;
}

export function createApiMiddleware(root: string): ApiMiddleware {
  const activity = createActivityManager(root);
  const git = createGitManager(root);
  const status = createStatusManager(root);
  const hooks = createAgentHooks(root, git);
  const agent = createAgentManager(
    root,
    hooks.stampAuditDate,
    hooks.commitPhase,
    hooks.setRunReview,
  );

  const routes = buildRoutes({ root, activity, agent, git, status });

  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = (req.url ?? '').split('?')[0];

    // Only guard our own /api surface — static assets / Vite HMR fall through to
    // next() untouched so the SPA still loads from any interface.
    if (pathname.startsWith('/api/') && isForbiddenRequest(req)) {
      sendJson(res, 403, { error: 'Forbidden: request failed the Host/Origin check' });
      return;
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
  return handler as ApiMiddleware;
}
