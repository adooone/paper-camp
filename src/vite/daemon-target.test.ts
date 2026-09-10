import { mkdtemp, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeDaemonState } from '../core/daemon-state';
import { type MachineRegistry, addProject, saveRegistry } from '../core/machine-registry';
import { MACHINE_PROJECTS_PATH } from '../types/index';
import { resolveDaemonTarget } from './daemon-target';

describe('resolveDaemonTarget', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];
  let originalConfigDir: string | undefined;

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
    // biome-ignore lint/performance/noDelete: an undefined assignment stringifies to "undefined" on process.env, unlike a plain object.
    if (originalConfigDir === undefined) delete process.env.PAPERCAMP_CONFIG_DIR;
    else process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
  });

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-target-'));
    dirs.push(dir);
    originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
    process.env.PAPERCAMP_CONFIG_DIR = dir;
  });

  async function makeRegistry(projects: Array<{ path: string; name: string }>): Promise<void> {
    let registry: MachineRegistry = { version: 1, projects: [] };
    for (const project of projects) {
      registry = addProject(registry, project.path, project.name).registry;
    }
    await saveRegistry(join(process.env.PAPERCAMP_CONFIG_DIR as string, 'projects.json'), registry);
  }

  async function listenOnFreePort(): Promise<number> {
    const server = createServer((req, res) => {
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ projects: [] }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    servers.push(server);
    return new Promise((resolve) => {
      server.listen(0, () => resolve((server.address() as AddressInfo).port));
    });
  }

  async function writeRunningDaemon(port: number): Promise<void> {
    await writeDaemonState(join(process.env.PAPERCAMP_CONFIG_DIR as string, 'daemon.json'), {
      pid: process.pid,
      port,
      version: '0.28.0',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: false,
    });
  }

  it('resolves the origin and slug for a registered root with a live daemon', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);
    const port = await listenOnFreePort();
    await writeRunningDaemon(port);

    const target = await resolveDaemonTarget('/repo/alpha');

    expect(target).toEqual({ origin: `http://localhost:${port}`, slug: 'alpha' });
  });

  it('resolves undefined for a root the registry does not know', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);
    const port = await listenOnFreePort();
    await writeRunningDaemon(port);

    expect(await resolveDaemonTarget('/repo/unknown')).toBeUndefined();
  });

  it('resolves undefined for a registered root with no daemon.json', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);

    expect(await resolveDaemonTarget('/repo/alpha')).toBeUndefined();
  });

  it('resolves undefined for a registered root whose daemon.json points at a dead process', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);
    await writeDaemonState(join(process.env.PAPERCAMP_CONFIG_DIR as string, 'daemon.json'), {
      pid: 999999,
      port: 4333,
      version: '0.28.0',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: false,
    });

    expect(await resolveDaemonTarget('/repo/alpha')).toBeUndefined();
  });

  it('uses the port override instead of reading daemon.json, still keyed off the registered slug', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);
    const port = await listenOnFreePort();
    await writeRunningDaemon(port + 1);

    const target = await resolveDaemonTarget('/repo/alpha', port);

    expect(target).toEqual({ origin: `http://localhost:${port}`, slug: 'alpha' });
  });

  it('resolves undefined for an unregistered root even with a port override', async () => {
    await makeRegistry([{ path: '/repo/alpha', name: 'Alpha' }]);

    expect(await resolveDaemonTarget('/repo/unknown', 4333)).toBeUndefined();
  });
});
