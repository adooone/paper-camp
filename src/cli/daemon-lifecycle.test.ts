import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { type DaemonState, isProcessAlive, writeDaemonState } from '../core/daemon-state';
import { MACHINE_PROJECTS_PATH } from '../types/index';
import { buildDaemonArgs, restartOptionsFromState } from './daemon-lifecycle';

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

describe('restartOptionsFromState', () => {
  const state: DaemonState = {
    pid: 1,
    port: 4333,
    version: '0.27.0',
    startedAt: new Date().toISOString(),
    share: true,
    tailnet: false,
  };

  it('carries the port and flags recorded in the state', () => {
    expect(restartOptionsFromState(state)).toEqual({ port: 4333, share: true, tailnet: false });
  });

  it('is empty when nothing was running', () => {
    expect(restartOptionsFromState(null)).toEqual({});
  });
});

const CLI_ENTRY = join(__dirname, 'index.ts');

const FAKE_DAEMON_SCRIPT = `
const { createServer } = require('node:http');
const { writeFileSync, rmSync } = require('node:fs');

const statePath = process.env.FAKE_DAEMON_STATE_PATH;
const server = createServer((req, res) => {
  if (req.url === '${MACHINE_PROJECTS_PATH}') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ projects: [] }));
    return;
  }
  res.statusCode = 404;
  res.end();
});
server.listen(0, () => {
  const port = server.address().port;
  writeFileSync(statePath, JSON.stringify({
    pid: process.pid,
    port,
    version: '0.27.0',
    startedAt: new Date().toISOString(),
    share: process.env.FAKE_DAEMON_SHARE === '1',
    tailnet: process.env.FAKE_DAEMON_TAILNET === '1',
  }));
  console.log('READY');
});

if (process.env.FAKE_DAEMON_IGNORE_SIGTERM === '1') {
  process.on('SIGTERM', () => {});
} else {
  process.on('SIGTERM', () => {
    rmSync(statePath, { force: true });
    process.exit(0);
  });
}
`;

describe('paper-camp start / stop / restart (CLI)', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];
  const children: ChildProcess[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
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

  /** `spawnSync` blocks this process's event loop: it can't answer the
   * in-process fake HTTP server, and it can't reap an exited fake-daemon
   * child either, leaving a zombie `isProcessAlive` still sees as running. */
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

  /** A real OS process (not just an in-process HTTP server) is required to
   * exercise `stop`'s SIGTERM/SIGKILL escalation — signalling this test
   * runner's own pid would kill the test run. */
  async function spawnFakeDaemon(
    configDir: string,
    opts: { ignoreSigterm?: boolean; share?: boolean; tailnet?: boolean } = {},
  ): Promise<DaemonState> {
    const statePath = join(configDir, 'daemon.json');
    const child = spawn('node', ['-e', FAKE_DAEMON_SCRIPT], {
      env: {
        ...process.env,
        FAKE_DAEMON_STATE_PATH: statePath,
        FAKE_DAEMON_IGNORE_SIGTERM: opts.ignoreSigterm ? '1' : '0',
        FAKE_DAEMON_SHARE: opts.share ? '1' : '0',
        FAKE_DAEMON_TAILNET: opts.tailnet ? '1' : '0',
      },
    });
    children.push(child);
    await new Promise<void>((resolve) => {
      child.stdout?.once('data', () => resolve());
    });
    const state = JSON.parse(await readFile(statePath, 'utf-8'));
    return state;
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

  it('stop reports nothing running and exits 0 when there is no daemon', async () => {
    const configDir = await makeConfigDir();

    const result = runCli(['stop'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('paper-camp: daemon is not running');
  });

  it('stop sends SIGTERM, waits for exit, and removes the state file', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir);

    const result = await runCliAsync(['stop'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    await expect(access(join(configDir, 'daemon.json'))).rejects.toThrow();
  });

  it('stop escalates to SIGKILL when the daemon ignores SIGTERM, then removes the state file', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir, { ignoreSigterm: true });

    const result = await runCliAsync(['stop'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    await expect(access(join(configDir, 'daemon.json'))).rejects.toThrow();
  }, 10_000);

  it('restart stops the running daemon, then attempts to start a new one', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir, { share: true });

    const result = await runCliAsync(['restart'], configDir);

    expect(result.stdout).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    // The re-invoked `daemon` subcommand fails fast (no dist/app under this
    // source-tree run), so `restart` surfaces the same failure `start` would.
    expect(result.status).toBe(1);
  });
});
