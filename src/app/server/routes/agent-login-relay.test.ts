import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CheckName } from '@/types/index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { agentRoutes } from './agent';
import type { RouteContext } from './types';

const originalPath = process.env.PATH;
const dirs: string[] = [];

/** Prepends a fake `claude` executable running `script` onto PATH. */
function installClaude(script: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-login-relay-route-bin-'));
  writeFileSync(join(dir, 'claude'), `#!/bin/sh\n${script}\n`);
  chmodSync(join(dir, 'claude'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
  dirs.push(dir);
}

afterEach(async () => {
  process.env.PATH = originalPath;
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function route(path: string, ctx: Partial<RouteContext> = {}) {
  const found = agentRoutes({ root: process.cwd(), ...ctx } as RouteContext).find(
    (r) => r.path === path,
  );
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(): IncomingMessage {
  return { url: '', headers: {}, on: () => {} } as unknown as IncomingMessage;
}

function fakeBodyReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: '',
    headers: {},
    on(event: string, cb: (chunk?: string) => void) {
      listeners[event] = cb;
      return req;
    },
  } as unknown as IncomingMessage;
  queueMicrotask(() => {
    listeners.data?.(body);
    listeners.end?.();
  });
  return req;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk: string) => {
      body = chunk;
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

function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = async () => {
      if (await predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timed out waiting for state'));
      setTimeout(tick, 20);
    };
    tick();
  });
}

describe('GET /api/agent/login-relay/status', () => {
  it('returns null when no relay has been started', async () => {
    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/status').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });
});

describe('POST /api/agent/login-relay/start', () => {
  it('spawns the relay and returns its state', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/start').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect((json() as { phase: string }).phase).toMatch(/starting|awaiting-authorization/);

    const cancel = fakeRes();
    await route('/api/agent/login-relay/cancel').handle(fakeReq(), cancel.res);
  });
});

describe('POST /api/agent/login-relay/start resuming parked runs', () => {
  it('resumes auth-parked tasks once `claude auth status` confirms loggedIn', async () => {
    installClaude(
      `if [ "$1" = "auth" ] && [ "$2" = "login" ]; then
         echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 0.1; exit 0
       elif [ "$1" = "auth" ] && [ "$2" = "status" ]; then
         echo '{"loggedIn": true, "authMethod": "oauth", "apiProvider": null}'; exit 0
       fi`,
    );
    const runChecksAndWait = vi.fn(async () => [] as CheckName[]);
    const resumeAuthParkedTasks = vi.fn(async (_runProjectChecks?: () => Promise<CheckName[]>) => ({
      resumed: [] as string[],
    }));
    const { res } = fakeRes();
    await route('/api/agent/login-relay/start', {
      agent: { resumeAuthParkedTasks } as unknown as RouteContext['agent'],
      status: { runChecksAndWait } as unknown as RouteContext['status'],
    }).handle(fakeReq(), res);

    await waitFor(async () => resumeAuthParkedTasks.mock.calls.length > 0);
    const runProjectChecks = resumeAuthParkedTasks.mock.calls[0][0] as () => Promise<unknown>;
    await runProjectChecks();
    expect(runChecksAndWait).toHaveBeenCalledOnce();
  });
});

describe('GET /api/agent/login-relay/status reflects an active relay', () => {
  it('reflects the state of a started relay', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const start = fakeRes();
    await route('/api/agent/login-relay/start').handle(fakeReq(), start.res);

    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { phase: string }).phase === 'awaiting-authorization';
    });

    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/status').handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toMatchObject({
      phase: 'awaiting-authorization',
      authorizeUrl: 'https://claude.com/cai/oauth/authorize?code=true',
    });

    const cancel = fakeRes();
    await route('/api/agent/login-relay/cancel').handle(fakeReq(), cancel.res);
  });
});

describe('POST /api/agent/login-relay/cancel', () => {
  it('cancels a pending relay', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const start = fakeRes();
    await route('/api/agent/login-relay/start').handle(fakeReq(), start.res);
    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { phase: string }).phase === 'awaiting-authorization';
    });

    const { res, status } = fakeRes();
    await route('/api/agent/login-relay/cancel').handle(fakeReq(), res);
    expect(status()).toBe(202);

    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { phase: string })?.phase === 'cancelled';
    });
  });

  it('is a no-op when nothing is pending', async () => {
    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/cancel').handle(fakeReq(), res);
    expect(status()).toBe(202);
    expect(json()).toEqual({ ok: true });
  });
});

describe('POST /api/agent/login-relay/code', () => {
  it('rejects an empty code', async () => {
    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/code').handle(
      fakeBodyReq(JSON.stringify({ code: '  ' })),
      res,
    );
    expect(status()).toBe(400);
    expect(json()).toEqual({ error: 'code is required' });
  });

  it('reports 409 when no code prompt is pending', async () => {
    installClaude("echo 'visit: https://claude.com/cai/oauth/authorize?code=true'; sleep 5");
    const start = fakeRes();
    await route('/api/agent/login-relay/start').handle(fakeReq(), start.res);
    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { phase: string }).phase === 'awaiting-authorization';
    });

    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/code').handle(
      fakeBodyReq(JSON.stringify({ code: 'ABC-123' })),
      res,
    );
    expect(status()).toBe(409);
    expect(json()).toEqual({ error: 'No code prompt is pending' });

    const cancel = fakeRes();
    await route('/api/agent/login-relay/cancel').handle(fakeReq(), cancel.res);
  });

  it('writes the code to the pty and clears needsCode (IDEA-236)', async () => {
    installClaude(
      `echo 'visit: https://claude.com/cai/oauth/authorize?code=true'
       sleep 0.1
       printf 'Paste code here if prompted > '
       read CODE
       if [ "$CODE" = "ABC-123" ]; then exit 0; else exit 1; fi`,
    );
    const start = fakeRes();
    await route('/api/agent/login-relay/start').handle(fakeReq(), start.res);
    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { needsCode?: boolean }).needsCode === true;
    });

    const { res, status, json } = fakeRes();
    await route('/api/agent/login-relay/code').handle(
      fakeBodyReq(JSON.stringify({ code: 'ABC-123' })),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toMatchObject({ needsCode: false });

    await waitFor(async () => {
      const check = fakeRes();
      await route('/api/agent/login-relay/status').handle(fakeReq(), check.res);
      return (check.json() as { phase: string }).phase === 'success';
    });
  });
});
