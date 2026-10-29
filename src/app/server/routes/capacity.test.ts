import { mkdtemp, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCapacity } from '@/core/capacity';
import type { RateLimitSnapshot } from '@/types/index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockProbeCapacity } = vi.hoisted(() => ({ mockProbeCapacity: vi.fn() }));
vi.mock('../capacity-probe', () => ({ probeCapacity: mockProbeCapacity }));

import { capacityRoutes } from './capacity';
import type { RouteContext } from './types';

const dirs: string[] = [];

beforeEach(async () => {
  const configDir = await mkdtemp(join(tmpdir(), 'paper-camp-capacity-route-config-'));
  dirs.push(configDir);
  vi.stubEnv('PAPERCAMP_CONFIG_DIR', configDir);
});

afterEach(async () => {
  mockProbeCapacity.mockReset();
  vi.unstubAllEnvs();
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

async function makeRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-capacity-route-test-'));
  dirs.push(dir);
  return dir;
}

function route(path: string, method: string, ctx: Record<string, unknown>) {
  const found = capacityRoutes(ctx as unknown as RouteContext).find(
    (r) => r.path === path && r.method === method,
  );
  if (!found) throw new Error(`no route registered for ${method} ${path}`);
  return found;
}

function fakeReq(): IncomingMessage {
  return {} as unknown as IncomingMessage;
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

const snapshot: RateLimitSnapshot = {
  status: 'allowed',
  unifiedWindows: { five_hour: { utilization: 0.5 } },
};

describe('GET /api/capacity', () => {
  it('returns null when no capacity file has been written', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route('/api/capacity', 'GET', { root }).handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });
});

describe('POST /api/capacity/refresh', () => {
  it('answers 503 with the CLI-signed-out message and writes nothing on a failed probe', async () => {
    mockProbeCapacity.mockResolvedValue(null);
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route('/api/capacity/refresh', 'POST', { root }).handle(fakeReq(), res);
    expect(status()).toBe(503);
    expect((json() as { error: string }).error).toMatch(/signed in/);
    expect(await readCapacity()).toBeNull();
  });

  it('writes the probe reading, publishes a capacity event, and returns the new reading', async () => {
    mockProbeCapacity.mockResolvedValue(snapshot);
    const root = await makeRoot();
    const publish = vi.fn();
    const { res, status, json } = fakeRes();
    await route('/api/capacity/refresh', 'POST', { root, activity: { publish } }).handle(
      fakeReq(),
      res,
    );
    expect(status()).toBe(200);
    const body = json() as { snapshot: RateLimitSnapshot; source: string };
    expect(body.snapshot).toEqual(snapshot);
    expect(body.source).toBe('probe');
    expect(publish).toHaveBeenCalledWith({ type: 'capacity' });
    expect((await readCapacity())?.source).toBe('probe');
  });
});
