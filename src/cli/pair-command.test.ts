import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TailnetStatus } from '../core/tailnet';

const { mockReadTailnetStatus } = vi.hoisted(() => ({
  mockReadTailnetStatus: vi.fn<() => Promise<TailnetStatus | undefined>>(),
}));
vi.mock('../core/tailnet', () => ({ readTailnetStatus: mockReadTailnetStatus }));

import { createPairCodeManager } from '../app/server/pair-code';
import { writeDaemonState } from '../core/daemon-state';
import { loadOrMintUpdateToken, updateTokenPath } from '../core/update-token';
import { MACHINE_PROJECTS_PATH } from '../types/index';
import { createMachinePairCodeHandler } from './daemon-server';
import { formatPairCode, pairQrLink, runPair } from './pair-command';

const TAILNET: TailnetStatus = {
  selfDnsName: 'deimos.pitta-ray.ts.net',
  magicDnsSuffix: 'pitta-ray.ts.net',
  onlinePeers: [],
};

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timed out waiting for state'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('formatPairCode', () => {
  it('splits the eight characters into two groups of four', () => {
    expect(formatPairCode('7KQ4M9XZ')).toBe('7KQ4-M9XZ');
  });
});

describe('pairQrLink', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_HOSTED_CLIENT_URL');
  });

  it('encodes the code into the hosted client fragment', () => {
    expect(pairQrLink('7KQ4-M9XZ@deimos.pitta-ray.ts.net')).toBe(
      'https://paper.adoo.one/#pair=7KQ4-M9XZ@deimos.pitta-ray.ts.net',
    );
  });
});

describe('runPair', () => {
  const dirs: string[] = [];
  const servers: ReturnType<typeof createServer>[] = [];
  let originalConfigDir: string | undefined;
  let originalIsTTY: boolean | undefined;
  let isTtyChanged = false;

  afterEach(async () => {
    for (const server of servers.splice(0)) server.close();
    for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
    // biome-ignore lint/performance/noDelete: an undefined assignment stringifies to "undefined" on process.env, unlike a plain object.
    if (originalConfigDir === undefined) delete process.env.PAPERCAMP_CONFIG_DIR;
    else process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
    if (isTtyChanged) process.stdout.isTTY = originalIsTTY as boolean;
    isTtyChanged = false;
    mockReadTailnetStatus.mockReset();
  });

  async function makeConfigDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-pair-test-'));
    dirs.push(dir);
    originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
    process.env.PAPERCAMP_CONFIG_DIR = dir;
    return dir;
  }

  async function startDaemon(
    configDir: string,
    opts: { tailnet?: boolean } = {},
  ): Promise<ReturnType<typeof createPairCodeManager>> {
    const token = await loadOrMintUpdateToken(updateTokenPath());
    const manager = createPairCodeManager();
    const pairCodeHandler = createMachinePairCodeHandler(token, manager);
    const server = createServer((req, res) => {
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ projects: [] }));
        return;
      }
      void pairCodeHandler(req, res);
    });
    servers.push(server);
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
    });
    await writeDaemonState(join(configDir, 'daemon.json'), {
      pid: process.pid,
      port,
      version: '0.0.0-test',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: opts.tailnet ?? true,
    });
    return manager;
  }

  it('refuses when the daemon is not running', async () => {
    await makeConfigDir();
    mockReadTailnetStatus.mockResolvedValue(TAILNET);
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const ok = await runPair();
    spy.mockRestore();
    expect(ok).toBe(false);
    expect(errors.join('\n')).toContain('daemon is not running');
  });

  it('refuses when the daemon was started without --tailnet', async () => {
    const configDir = await makeConfigDir();
    await startDaemon(configDir, { tailnet: false });
    mockReadTailnetStatus.mockResolvedValue(TAILNET);
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const ok = await runPair();
    spy.mockRestore();
    expect(ok).toBe(false);
    expect(errors.join('\n')).toContain("isn't on a tailnet");
  });

  it('refuses when Tailscale itself is down', async () => {
    const configDir = await makeConfigDir();
    await startDaemon(configDir);
    mockReadTailnetStatus.mockResolvedValue(undefined);
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });
    const ok = await runPair();
    spy.mockRestore();
    expect(ok).toBe(false);
    expect(errors.join('\n')).toContain("isn't on a tailnet");
  });

  it('mints a code, prints the code line alone off a TTY, and reports when it is paired', async () => {
    const configDir = await makeConfigDir();
    const manager = await startDaemon(configDir);
    mockReadTailnetStatus.mockResolvedValue(TAILNET);
    originalIsTTY = process.stdout.isTTY;
    isTtyChanged = true;
    process.stdout.isTTY = false;

    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    const pairing = runPair();
    await waitFor(() => logs.some((line) => line.includes('@deimos.pitta-ray.ts.net')));
    const printed = logs.find((line) => line.includes('@deimos.pitta-ray.ts.net')) as string;
    expect(printed).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}@deimos\.pitta-ray\.ts\.net$/);
    const code = printed.split('@')[0].replace('-', '');

    manager.redeem(code, 'https://preview.vercel.app');
    const ok = await pairing;
    spy.mockRestore();

    expect(ok).toBe(true);
    expect(logs).toContain('Paired https://preview.vercel.app');
  });
});
