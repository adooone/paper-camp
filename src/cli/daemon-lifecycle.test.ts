import { type ChildProcess, type SpawnSyncReturns, spawn, spawnSync } from 'node:child_process';
import { access, appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { type DaemonState, isProcessAlive, writeDaemonState } from '../core/daemon-state';
import { type MachineRegistry, addProject, saveRegistry } from '../core/machine-registry';
import { MACHINE_PROJECTS_PATH, type MachineProjectSummary } from '../types/index';
import {
  buildDaemonArgs,
  formatProjectTable,
  lastLines,
  projectState,
  restartOptionsFromState,
} from './daemon-lifecycle';

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

describe('projectState', () => {
  it('is "—" for every slug when no daemon is running', () => {
    expect(projectState('demo', null)).toBe('—');
  });

  it('is "idle" when the daemon is running but does not know the slug', () => {
    expect(projectState('demo', [])).toBe('idle');
  });

  it('is "idle" for a known project that is not mounted', () => {
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: false, busy: false },
    ];
    expect(projectState('demo', projects)).toBe('idle');
  });

  it('is "mounted" for a mounted, idle project', () => {
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: true, busy: false },
    ];
    expect(projectState('demo', projects)).toBe('mounted');
  });

  it('is "busy" over "mounted" for a project with a task in flight', () => {
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: true, busy: true },
    ];
    expect(projectState('demo', projects)).toBe('busy');
  });
});

describe('formatProjectTable', () => {
  it('reports no projects registered', () => {
    expect(formatProjectTable([], null)).toBe('No projects registered.');
  });

  it('pads the slug and state columns and shows "—" for every row with no daemon running', () => {
    const projects = [
      { slug: 'alpha', path: '/some/alpha', name: 'Alpha' },
      { slug: 'longer-slug', path: '/some/longer-slug', name: 'Longer' },
    ];

    expect(formatProjectTable(projects, null)).toBe(
      'alpha        —  /some/alpha\n' + 'longer-slug  —  /some/longer-slug',
    );
  });

  it('shows the live mounted/busy/idle state per project once a daemon answers', () => {
    const projects = [
      { slug: 'alpha', path: '/some/alpha', name: 'Alpha' },
      { slug: 'beta', path: '/some/beta', name: 'Beta' },
    ];
    const liveProjects: MachineProjectSummary[] = [
      { slug: 'alpha', name: 'Alpha', mounted: true, busy: true },
      { slug: 'beta', name: 'Beta', mounted: false, busy: false },
    ];

    expect(formatProjectTable(projects, liveProjects)).toBe(
      'alpha  busy  /some/alpha\n' + 'beta   idle  /some/beta',
    );
  });
});

describe('lastLines', () => {
  it('returns every line when there are fewer than the requested count', () => {
    expect(lastLines('one\ntwo\n', 50)).toEqual(['one', 'two']);
  });

  it('returns only the last n lines', () => {
    expect(lastLines('one\ntwo\nthree\nfour\n', 2)).toEqual(['three', 'four']);
  });

  it('keeps a trailing line with no newline after it', () => {
    expect(lastLines('one\ntwo', 50)).toEqual(['one', 'two']);
  });

  it('is empty for an empty file', () => {
    expect(lastLines('', 50)).toEqual([]);
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
    const projects = process.env.FAKE_DAEMON_PROJECTS
      ? JSON.parse(process.env.FAKE_DAEMON_PROJECTS)
      : [];
    res.end(JSON.stringify({ projects }));
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

describe('paper-camp start / stop / restart / status / ls / logs (CLI)', () => {
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

  async function makeRegistry(
    configDir: string,
    projects: Array<{ path: string; name: string }>,
  ): Promise<void> {
    let registry: MachineRegistry = { version: 1, projects: [] };
    for (const project of projects) {
      registry = addProject(registry, project.path, project.name).registry;
    }
    await saveRegistry(join(configDir, 'projects.json'), registry);
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
    opts: {
      ignoreSigterm?: boolean;
      share?: boolean;
      tailnet?: boolean;
      projects?: MachineProjectSummary[];
    } = {},
  ): Promise<DaemonState> {
    const statePath = join(configDir, 'daemon.json');
    const child = spawn('node', ['-e', FAKE_DAEMON_SCRIPT], {
      env: {
        ...process.env,
        FAKE_DAEMON_STATE_PATH: statePath,
        FAKE_DAEMON_IGNORE_SIGTERM: opts.ignoreSigterm ? '1' : '0',
        FAKE_DAEMON_SHARE: opts.share ? '1' : '0',
        FAKE_DAEMON_TAILNET: opts.tailnet ? '1' : '0',
        ...(opts.projects ? { FAKE_DAEMON_PROJECTS: JSON.stringify(opts.projects) } : {}),
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

  it('ls prints "—" for every project when no daemon is running', async () => {
    const configDir = await makeConfigDir();
    await makeRegistry(configDir, [{ path: '/some/demo', name: 'Demo' }]);

    const result = runCli(['ls'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('demo  —  /some/demo');
  });

  it('ls reports "No projects registered." with no daemon running and an empty registry', async () => {
    const configDir = await makeConfigDir();

    const result = runCli(['ls'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('No projects registered.');
  });

  it('ls reports mounted/busy state per project once the daemon answers', async () => {
    const configDir = await makeConfigDir();
    await makeRegistry(configDir, [
      { path: '/some/alpha', name: 'Alpha' },
      { path: '/some/beta', name: 'Beta' },
    ]);
    await spawnFakeDaemon(configDir, {
      projects: [
        { slug: 'alpha', name: 'Alpha', mounted: true, busy: true },
        { slug: 'beta', name: 'Beta', mounted: false, busy: false },
      ],
    });

    const result = runCli(['ls'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('alpha  busy  /some/alpha\nbeta   idle  /some/beta');
  });

  it('status reports the daemon as not running, then the "—" project table', async () => {
    const configDir = await makeConfigDir();
    await makeRegistry(configDir, [{ path: '/some/demo', name: 'Demo' }]);

    const result = runCli(['status'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('paper-camp: daemon is not running');
    expect(result.stdout).toContain('demo  —  /some/demo');
  });

  it('status reports the running daemon block, then the live project table', async () => {
    const configDir = await makeConfigDir();
    await makeRegistry(configDir, [{ path: '/some/demo', name: 'Demo' }]);
    const state = await spawnFakeDaemon(configDir, {
      projects: [{ slug: 'demo', name: 'Demo', mounted: true, busy: false }],
    });

    const result = runCli(['status'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`paper-camp: daemon running — pid ${state.pid}`);
    expect(result.stdout).toContain('demo  mounted  /some/demo');
  });

  it('logs says so and exits 0 when there is no daemon.log yet', async () => {
    const configDir = await makeConfigDir();

    const result = runCli(['logs'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('paper-camp: no daemon.log yet');
  });

  it('logs -f also exits 0 immediately when there is no daemon.log yet', async () => {
    const configDir = await makeConfigDir();

    const result = runCli(['logs', '-f'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('paper-camp: no daemon.log yet');
  });

  it('logs defaults to printing the last 50 lines of daemon.log', async () => {
    const configDir = await makeConfigDir();
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`);
    await writeFile(join(configDir, 'daemon.log'), `${lines.join('\n')}\n`, 'utf-8');

    const result = runCli(['logs'], configDir);

    const printed = result.stdout.trim().split('\n');
    expect(printed).toHaveLength(50);
    expect(printed[0]).toBe('line 10');
    expect(printed.at(-1)).toBe('line 59');
  });

  it('logs -n limits the printed lines to the requested count', async () => {
    const configDir = await makeConfigDir();
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    await writeFile(join(configDir, 'daemon.log'), `${lines.join('\n')}\n`, 'utf-8');

    const result = runCli(['logs', '-n', '3'], configDir);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('line 7\nline 8\nline 9');
  });

  async function waitUntil(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('timed out waiting for condition');
  }

  it('logs -f prints existing content, then follows appended lines until killed', async () => {
    const configDir = await makeConfigDir();
    const logPath = join(configDir, 'daemon.log');
    await writeFile(logPath, 'line 1\n', 'utf-8');

    const child = spawn('bun', [CLI_ENTRY, 'logs', '-f'], {
      env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
    });
    children.push(child);
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    await waitUntil(() => stdout.includes('line 1'));

    await appendFile(logPath, 'line 2\n', 'utf-8');
    await waitUntil(() => stdout.includes('line 2'));

    child.kill('SIGKILL');
    expect(stdout).toContain('line 1');
    expect(stdout).toContain('line 2');
  });
});
