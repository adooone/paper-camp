import type { IncomingMessage, ServerResponse } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAgentSignIn, markAgentSignedOut, resetAgentSignInForTests } from '../agent-signin';
import { agentRoutes } from './agent';
import type { RouteContext } from './types';

const mock = vi.hoisted(() => ({
  cleared: 0,
  probe: { signedIn: true } as { signedIn: boolean | null; reason?: string },
}));

vi.mock('../capacity-probe', () => ({
  probeSignIn: async () => mock.probe,
}));

vi.mock('../capabilities', () => ({
  clearCapabilitiesCache: () => {},
  clearAgentAuthStatusCache: () => {
    mock.cleared += 1;
  },
  probeAgentAuthStatus: async () => ({ loggedIn: null, authMethod: null, apiProvider: null }),
}));

const ROOT = '/papercamp-agent-auth-status-test-root';

function route(path: string) {
  const found = agentRoutes({
    root: ROOT,
    activity: { notifyChanged: () => {}, publish: () => {} },
  } as unknown as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(url: string): IncomingMessage {
  return { url, headers: { host: 'localhost' } } as unknown as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk?: string) => {
      body = chunk ?? '';
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, json: () => JSON.parse(body) };
}

beforeEach(() => resetAgentSignInForTests());

describe('GET /api/agent/auth-status', () => {
  it('serves the cached probe without clearing it', async () => {
    mock.cleared = 0;
    const { res } = fakeRes();
    await route('/api/agent/auth-status').handle(fakeReq('/api/agent/auth-status'), res);
    expect(mock.cleared).toBe(0);
  });

  it('clears the agent auth status cache when recheck is requested', async () => {
    mock.cleared = 0;
    const { res } = fakeRes();
    await route('/api/agent/auth-status').handle(fakeReq('/api/agent/auth-status?recheck=1'), res);
    expect(mock.cleared).toBe(1);
  });
});

describe('signed-out state on the auth routes', () => {
  it('reports a recorded sign-out as not logged in, with the CLI reason', async () => {
    markAgentSignedOut('Failed to authenticate: OAuth session expired');
    const { res, json } = fakeRes();
    await route('/api/agent/auth-status').handle(fakeReq('/api/agent/auth-status'), res);
    expect(json()).toMatchObject({
      loggedIn: false,
      reason: 'Failed to authenticate: OAuth session expired',
    });
  });

  it('clears the sign-out when the sign-in check gets a reply', async () => {
    markAgentSignedOut('Failed to authenticate: OAuth session expired');
    mock.probe = { signedIn: true };
    const { res, json } = fakeRes();
    await route('/api/agent/auth-check').handle(fakeReq('/api/agent/auth-check'), res);
    expect(json()).toEqual({ signedIn: true });
    expect(getAgentSignIn().signedOut).toBe(false);
  });

  it('records a sign-out when the sign-in check is refused', async () => {
    mock.probe = { signedIn: false, reason: 'Invalid API key · Please run /login' };
    const { res } = fakeRes();
    await route('/api/agent/auth-check').handle(fakeReq('/api/agent/auth-check'), res);
    expect(getAgentSignIn()).toMatchObject({
      signedOut: true,
      reason: 'Invalid API key · Please run /login',
    });
  });

  it('leaves the state alone when the check cannot tell', async () => {
    markAgentSignedOut('Failed to authenticate: OAuth session expired');
    mock.probe = { signedIn: null, reason: 'Claude did not answer in time' };
    const { res } = fakeRes();
    await route('/api/agent/auth-check').handle(fakeReq('/api/agent/auth-check'), res);
    expect(getAgentSignIn().reason).toBe('Failed to authenticate: OAuth session expired');
  });
});
