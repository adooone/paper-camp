import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { MACHINE_PROJECTS_PATH } from '../../types/index';
import {
  type DaemonState,
  readRunningDaemonState,
  removeDaemonState,
  writeDaemonState,
} from './daemon-state';

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
    const state: DaemonState = { ...baseState, pid: process.pid, port };
    await writeDaemonState(path, state);

    expect(await readRunningDaemonState(path)).toEqual(state);
    await expect(access(path)).resolves.toBeUndefined();
  });
});
