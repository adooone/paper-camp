import { type SpawnSyncReturns, spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { writeDaemonState } from '../core/daemon-state';
import { MACHINE_PROJECTS_PATH } from '../types/index';
import { buildDaemonArgs } from './daemon-lifecycle';

describe('buildDaemonArgs', () => {
  it('is just "daemon" with no flags given', () => {
    expect(buildDaemonArgs({})).toEqual(['daemon']);
  });

  it('carries the port, share, and tailnet flags through', () => {
    expect(buildDaemonArgs({ port: 5000, share: true, tailnet: true })).toEqual([
      'daemon',
      '-p',
      '5000',
      '--share',
      '--tailnet',
    ]);
  });

  it('omits a flag left unset', () => {
    expect(buildDaemonArgs({ port: 5000 })).toEqual(['daemon', '-p', '5000']);
  });
});

const CLI_ENTRY = join(__dirname, 'index.ts');

describe('paper-camp start (CLI)', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function makeConfigDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-start-test-'));
    dirs.push(dir);
    return dir;
  }

  function runCli(args: string[], configDir: string): SpawnSyncReturns<string> {
    return spawnSync('bun', [CLI_ENTRY, ...args], {
      encoding: 'utf-8',
      env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
      timeout: 15_000,
    });
  }

  /** `spawnSync` blocks this process's event loop, which would starve the
   * in-process fake HTTP server the "already running" test relies on for an
   * answer — a real async `spawn` is required whenever the child depends on
   * this process staying responsive while it runs. */
  function runCliAsync(
    args: string[],
    configDir: string,
  ): Promise<{ status: number | null; stdout: string }> {
    return new Promise((resolve) => {
      const child = spawn('bun', [CLI_ENTRY, ...args], {
        env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
      });
      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.on('close', (status) => resolve({ status, stdout }));
    });
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

  it('refuses a second daemon and prints the status line for the one already running', async () => {
    const configDir = await makeConfigDir();
    const port = await listenOnFreePort();
    await writeDaemonState(join(configDir, 'daemon.json'), {
      pid: process.pid,
      port,
      version: '0.27.0',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: false,
    });

    const result = await runCliAsync(['start'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('daemon running');
    expect(result.stdout).toContain(`pid ${process.pid}`);
    await expect(access(join(configDir, 'daemon.log'))).rejects.toThrow();
  });

  it('prints the log and exits 1 when the spawned daemon dies before answering', async () => {
    const configDir = await makeConfigDir();

    const result = runCli(['start'], configDir);

    expect(result.status).toBe(1);
    const log = await readFile(join(configDir, 'daemon.log'), 'utf-8');
    expect(log.length).toBeGreaterThan(0);
    expect(result.stdout).toContain(log.trim());
  });
});
