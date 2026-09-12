import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { MACHINE_NIGHT_PATH, MACHINE_PROJECTS_PATH } from '../../types/index';
import {
  type DaemonLinks,
  type DaemonState,
  fetchMachineNightGate,
  fetchMachineProjects,
  formatDaemonLinks,
  formatDaemonStatusLine,
  formatUpdateStatusLine,
  qrEligibleLink,
  readRunningDaemonState,
  removeDaemonState,
  writeDaemonState,
} from './daemon-state';

const baseDaemonState: DaemonState = {
  pid: 1,
  port: 4333,
  version: '0.27.0',
  startedAt: new Date().toISOString(),
  share: false,
  tailnet: false,
};

describe('writeDaemonState / removeDaemonState', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeStatePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-state-test-'));
    dirs.push(dir);
    return join(dir, 'daemon.json');
  }

  const sampleState: DaemonState = {
    pid: 1234,
    port: 4333,
    version: '0.27.0',
    startedAt: '2026-09-05T00:00:00.000Z',
    share: false,
    tailnet: true,
  };

  it('writes pid, port, version, startedAt and the share/tailnet flags to disk', async () => {
    const path = await makeStatePath();

    await writeDaemonState(path, sampleState);

    const written = JSON.parse(await readFile(path, 'utf-8'));
    expect(written).toEqual(sampleState);
  });

  it('creates the config dir if it does not exist yet', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-state-test-'));
    dirs.push(dir);
    const path = join(dir, 'nested', 'daemon.json');

    await writeDaemonState(path, sampleState);

    await expect(access(path)).resolves.toBeUndefined();
  });

  it('removes the state file', async () => {
    const path = await makeStatePath();
    await writeDaemonState(path, sampleState);

    await removeDaemonState(path);

    await expect(access(path)).rejects.toThrow();
  });

  it('is a no-op when the state file does not exist', async () => {
    const path = await makeStatePath();

    await expect(removeDaemonState(path)).resolves.toBeUndefined();
  });
});

describe('readRunningDaemonState', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function makeStatePath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-state-test-'));
    dirs.push(dir);
    return join(dir, 'daemon.json');
  }

  function deadPid(): number {
    const child = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    return child.pid as number;
  }

  async function listenOnFreePort(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<number> {
    const server = createServer(handler);
    servers.push(server);
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
    });
  }

  const baseState: Omit<DaemonState, 'pid' | 'port'> = {
    version: '0.27.0',
    startedAt: '2026-09-05T00:00:00.000Z',
    share: false,
    tailnet: false,
  };

  it('resolves null when no state file exists', async () => {
    const path = await makeStatePath();

    expect(await readRunningDaemonState(path)).toBeNull();
  });

  it('resolves null and removes malformed JSON', async () => {
    const path = await makeStatePath();
    await writeFile(path, 'not json', 'utf-8');

    expect(await readRunningDaemonState(path)).toBeNull();
    await expect(access(path)).rejects.toThrow();
  });

  it('resolves null and removes the file when the recorded pid is dead', async () => {
    const path = await makeStatePath();
    await writeDaemonState(path, { ...baseState, pid: deadPid(), port: 4333 });

    expect(await readRunningDaemonState(path)).toBeNull();
    await expect(access(path)).rejects.toThrow();
  });

  it('resolves null and removes the file when the pid is alive but nothing answers on the port', async () => {
    const path = await makeStatePath();
    const port = await listenOnFreePort((_req, res) => res.end());
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
    await writeDaemonState(path, { ...baseState, pid: process.pid, port });

    expect(await readRunningDaemonState(path)).toBeNull();
    await expect(access(path)).rejects.toThrow();
  });

  it('resolves the state and keeps the file when the pid is alive and the endpoint answers', async () => {
    const path = await makeStatePath();
    const port = await listenOnFreePort((req, res) => {
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ projects: [] }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    const state: DaemonState = {
      ...baseState,
      pid: process.pid,
      port,
      links: { host: 'http://localhost:1234' },
    };
    await writeDaemonState(path, state);

    expect(await readRunningDaemonState(path)).toEqual(state);
    await expect(access(path)).resolves.toBeUndefined();
  });

  it('round-trips the last update event and pending version', async () => {
    const path = await makeStatePath();
    const port = await listenOnFreePort((req, res) => {
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ projects: [] }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    const state: DaemonState = {
      ...baseState,
      pid: process.pid,
      port,
      updateEvent: { kind: 'hooked', version: '0.29.1', at: '2026-09-10T20:41:00.000Z' },
      updatePendingVersion: '0.29.1',
    };
    await writeDaemonState(path, state);

    expect(await readRunningDaemonState(path)).toEqual(state);
  });
});

describe('fetchMachineProjects', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function listenOnFreePort(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<number> {
    const server = createServer(handler);
    servers.push(server);
    return new Promise((resolve) => {
      server.listen(0, () => resolve((server.address() as AddressInfo).port));
    });
  }

  it('resolves the projects array the endpoint answers with', async () => {
    const projects = [{ slug: 'demo', name: 'Demo', mounted: true, busy: false }];
    const port = await listenOnFreePort((req, res) => {
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ projects }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    expect(await fetchMachineProjects(port)).toEqual(projects);
  });

  it('resolves null when nothing answers on the port', async () => {
    const port = await listenOnFreePort((_req, res) => res.end());
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));

    expect(await fetchMachineProjects(port)).toBeNull();
  });

  it('resolves null when the endpoint answers with a non-2xx status', async () => {
    const port = await listenOnFreePort((_req, res) => {
      res.statusCode = 500;
      res.end();
    });

    expect(await fetchMachineProjects(port)).toBeNull();
  });
});

describe('fetchMachineNightGate', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function listenOnFreePort(
    handler: (req: IncomingMessage, res: ServerResponse) => void,
  ): Promise<number> {
    const server = createServer(handler);
    servers.push(server);
    return new Promise((resolve) => {
      server.listen(0, () => resolve((server.address() as AddressInfo).port));
    });
  }

  it('resolves the gate response the endpoint answers with', async () => {
    const body = {
      slug: 'demo',
      projectMissing: false,
      gate: {
        open: false,
        reasons: ['task-running'],
        fiveHourUtilizationPct: 10,
        sevenDayUtilizationPct: 20,
      },
    };
    const port = await listenOnFreePort((req, res) => {
      if (req.url === MACHINE_NIGHT_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(body));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    expect(await fetchMachineNightGate(port)).toEqual(body);
  });

  it('resolves null when nothing answers on the port', async () => {
    const port = await listenOnFreePort((_req, res) => res.end());
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));

    expect(await fetchMachineNightGate(port)).toBeNull();
  });

  it('resolves null when the endpoint answers with a non-2xx status', async () => {
    const port = await listenOnFreePort((_req, res) => {
      res.statusCode = 500;
      res.end();
    });

    expect(await fetchMachineNightGate(port)).toBeNull();
  });
});

describe('formatDaemonStatusLine', () => {
  it('reports pid, port, version, and uptime with no flags noted', () => {
    const state: DaemonState = {
      pid: 4242,
      port: 4333,
      version: '0.27.0',
      startedAt: new Date(Date.now() - 65_000).toISOString(),
      share: false,
      tailnet: false,
    };

    const line = formatDaemonStatusLine(state);

    expect(line).toContain('pid 4242');
    expect(line).toContain('port 4333');
    expect(line).toContain('v0.27.0');
    expect(line).toContain('up 1m5s');
    expect(line).not.toContain('share');
    expect(line).not.toContain('tailnet');
  });

  it('lists the share and tailnet flags when set', () => {
    const state: DaemonState = {
      pid: 1,
      port: 4333,
      version: '0.27.0',
      startedAt: new Date().toISOString(),
      share: true,
      tailnet: true,
    };

    expect(formatDaemonStatusLine(state)).toContain('share, tailnet');
  });
});

describe('formatUpdateStatusLine', () => {
  it('reports no check yet when the daemon has not recorded one', () => {
    expect(formatUpdateStatusLine(baseDaemonState)).toBe('paper-camp: no update check yet');
  });

  it('reports a boot check that found nothing newer', () => {
    const state: DaemonState = {
      ...baseDaemonState,
      updateEvent: { kind: 'boot check current' },
    };

    expect(formatUpdateStatusLine(state)).toBe('paper-camp: boot check current');
  });

  it('reports the version and clock time a hook installed', () => {
    const at = new Date();
    at.setHours(20, 41, 0, 0);
    const state: DaemonState = {
      ...baseDaemonState,
      updateEvent: { kind: 'hooked', version: '0.30.2', at: at.toISOString() },
    };

    expect(formatUpdateStatusLine(state)).toBe('paper-camp: hooked 0.30.2 at 20:41');
  });

  it('names the pending version over the last event while it waits for the machine to go idle', () => {
    const state: DaemonState = {
      ...baseDaemonState,
      updateEvent: { kind: 'boot check current' },
      updatePendingVersion: '0.29.1',
    };

    expect(formatUpdateStatusLine(state)).toBe(
      'paper-camp: update to 0.29.1 pending, waiting for idle',
    );
  });

  it('names a version that installed but did not take effect', () => {
    const state: DaemonState = {
      ...baseDaemonState,
      updateEvent: { kind: 'failed', version: '0.29.1', output: '404 Not Found' },
    };

    expect(formatUpdateStatusLine(state)).toBe(
      'paper-camp: 0.29.1 installed but did not take effect — run `paper-camp update`',
    );
  });
});

describe('formatDaemonLinks', () => {
  const localLink =
    'https://paper-camp.vercel.app/?machine=http://localhost:4333&token=shared-token';
  const networkLink =
    'https://paper-camp.vercel.app/?machine=http://192.168.1.5:4333&token=shared-token';
  const tailnetLink =
    'https://paper-camp.vercel.app/?machine=https://box.tailnet.ts.net/&token=shared-token';
  const tunnelLink =
    'https://paper-camp.vercel.app/?machine=https://foo.trycloudflare.com&token=shared-token';

  it('lists only the host link when nothing else was found', () => {
    const links: DaemonLinks = { host: localLink };
    expect(formatDaemonLinks(links)).toBe(`This host  ${localLink}`);
  });

  it('lists every link the daemon has, in This host / Network / Tailnet / Tunnel order', () => {
    const links: DaemonLinks = {
      host: localLink,
      network: networkLink,
      tailnet: tailnetLink,
      tunnel: tunnelLink,
    };

    const formatted = formatDaemonLinks(links);
    const lines = formatted.split('\n');
    expect(lines[0]).toContain('This host');
    expect(lines[0]).toContain(localLink);
    expect(lines[1]).toContain('Network');
    expect(lines[1]).toContain(networkLink);
    expect(lines[2]).toContain('Tailnet');
    expect(lines[2]).toContain(tailnetLink);
    expect(lines[3]).toContain('Tunnel');
    expect(lines[3]).toContain(tunnelLink);
  });

  it('omits a row for a link the daemon does not have', () => {
    const links: DaemonLinks = { host: localLink, tailnet: tailnetLink };
    const formatted = formatDaemonLinks(links);
    expect(formatted).not.toContain('Network');
    expect(formatted).not.toContain('Tunnel');
  });
});

describe('qrEligibleLink', () => {
  const localLink =
    'https://paper-camp.vercel.app/?machine=http://localhost:4333&token=shared-token';
  const networkLink =
    'https://paper-camp.vercel.app/?machine=http://192.168.1.5:4333&token=shared-token';
  const tailnetLink =
    'https://paper-camp.vercel.app/?machine=https://box.tailnet.ts.net/&token=shared-token';
  const tunnelLink =
    'https://paper-camp.vercel.app/?machine=https://foo.trycloudflare.com&token=shared-token';

  it('prefers the Tailnet link over the Tunnel link', () => {
    expect(qrEligibleLink({ host: localLink, tailnet: tailnetLink, tunnel: tunnelLink })).toBe(
      tailnetLink,
    );
  });

  it('falls back to the Tunnel link when there is no Tailnet link', () => {
    expect(qrEligibleLink({ host: localLink, tunnel: tunnelLink })).toBe(tunnelLink);
  });

  it('is undefined for a host-only or Network-only link, neither reachable from a phone', () => {
    expect(qrEligibleLink({ host: localLink })).toBeUndefined();
    expect(qrEligibleLink({ host: localLink, network: networkLink })).toBeUndefined();
  });
});
