import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { access, appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { type DaemonState, isProcessAlive, writeDaemonState } from '../core/daemon-state';
import {
  type MachineProject,
  type MachineRegistry,
  addProject,
  saveRegistry,
} from '../core/machine-registry';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { MACHINE_PROJECTS_PATH, type MachineProjectSummary } from '../types/index';
import {
  MISSING_PROJECT_HINT,
  buildDaemonArgs,
  formatProjectTable,
  lastLines,
  projectState,
  restartOptionsFromState,
  runLogs,
  runLs,
  runRestart,
  runStart,
  runStatus,
  runStop,
  runUpdate,
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

  it('carries --no-auto-update through when disabled', () => {
    expect(buildDaemonArgs({ autoUpdate: false })).toEqual(['daemon', '--no-auto-update']);
  });

  it('omits --no-auto-update when auto-update is on or unset', () => {
    expect(buildDaemonArgs({ autoUpdate: true })).toEqual(['daemon']);
    expect(buildDaemonArgs({})).toEqual(['daemon']);
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
    autoUpdate: false,
  };

  it('carries the port and flags recorded in the state', () => {
    expect(restartOptionsFromState(state)).toEqual({
      port: 4333,
      share: true,
      tailnet: false,
      autoUpdate: false,
    });
  });

  it('is empty when nothing was running', () => {
    expect(restartOptionsFromState(null)).toEqual({});
  });
});

describe('projectState', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeProject(slug: string): Promise<MachineProject> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-project-state-'));
    dirs.push(dir);
    await mkdir(join(dir, 'papercamp'), { recursive: true });
    await writeFile(join(dir, 'papercamp', 'config.json'), '{}', 'utf-8');
    return { slug, path: dir, name: slug };
  }

  it('is "—" for a present project when no daemon is running', async () => {
    const project = await makeProject('demo');
    expect(await projectState(project, null)).toBe('—');
  });

  it('is "idle" when the daemon is running but does not know the slug', async () => {
    const project = await makeProject('demo');
    expect(await projectState(project, [])).toBe('idle');
  });

  it('is "idle" for a known project that is not mounted', async () => {
    const project = await makeProject('demo');
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: false, busy: false, missing: false },
    ];
    expect(await projectState(project, projects)).toBe('idle');
  });

  it('is "mounted" for a mounted, idle project', async () => {
    const project = await makeProject('demo');
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: true, busy: false, missing: false },
    ];
    expect(await projectState(project, projects)).toBe('mounted');
  });

  it('is "busy" over "mounted" for a project with a task in flight', async () => {
    const project = await makeProject('demo');
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: true, busy: true, missing: false },
    ];
    expect(await projectState(project, projects)).toBe('busy');
  });

  it('is "missing" over everything else when the folder has no papercamp/config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-project-state-'));
    dirs.push(dir);
    const project: MachineProject = { slug: 'demo', path: join(dir, 'gone'), name: 'Demo' };
    const projects: MachineProjectSummary[] = [
      { slug: 'demo', name: 'Demo', mounted: true, busy: true, missing: true },
    ];
    expect(await projectState(project, projects)).toBe('missing');
    expect(await projectState(project, null)).toBe('missing');
  });
});

describe('formatProjectTable', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeProject(slug: string): Promise<MachineProject> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-project-table-'));
    dirs.push(dir);
    await mkdir(join(dir, 'papercamp'), { recursive: true });
    await writeFile(join(dir, 'papercamp', 'config.json'), '{}', 'utf-8');
    return { slug, path: dir, name: slug };
  }

  it('reports no projects registered', async () => {
    expect(await formatProjectTable([], null)).toBe('No projects registered.');
  });

  it('pads the slug and state columns and shows "—" for every row with no daemon running', async () => {
    const alpha = await makeProject('alpha');
    const longerSlug = await makeProject('longer-slug');

    expect(await formatProjectTable([alpha, longerSlug], null)).toBe(
      `alpha        —  ${alpha.path}\n` + `longer-slug  —  ${longerSlug.path}`,
    );
  });

  it('shows the live mounted/busy/idle state per project once a daemon answers', async () => {
    const alpha = await makeProject('alpha');
    const beta = await makeProject('beta');
    const liveProjects: MachineProjectSummary[] = [
      { slug: 'alpha', name: 'Alpha', mounted: true, busy: true, missing: false },
      { slug: 'beta', name: 'Beta', mounted: false, busy: false, missing: false },
    ];

    expect(await formatProjectTable([alpha, beta], liveProjects)).toBe(
      `alpha  busy  ${alpha.path}\n` + `beta   idle  ${beta.path}`,
    );
  });

  it('appends an interrupted-run count for a project that lost one at its last boot', async () => {
    const alpha = await makeProject('alpha');
    const beta = await makeProject('beta');
    const liveProjects: MachineProjectSummary[] = [
      {
        slug: 'alpha',
        name: 'Alpha',
        mounted: true,
        busy: false,
        missing: false,
        interruptedCount: 2,
      },
      {
        slug: 'beta',
        name: 'Beta',
        mounted: true,
        busy: false,
        missing: false,
        interruptedCount: 0,
      },
    ];

    expect(await formatProjectTable([alpha, beta], liveProjects)).toBe(
      `alpha  mounted  ${alpha.path}  (2 interrupted)\n` + `beta   mounted  ${beta.path}`,
    );
  });

  it('prints missing in the STATE column and a hint to forget it below the table', async () => {
    const alpha = await makeProject('alpha');
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-project-table-'));
    dirs.push(dir);
    const deleted: MachineProject = { slug: 'deleted', path: join(dir, 'gone'), name: 'Deleted' };

    const table = await formatProjectTable([alpha, deleted], null);

    expect(table).toBe(
      `alpha    —        ${alpha.path}\ndeleted  missing  ${deleted.path}\n\n${MISSING_PROJECT_HINT}`,
    );
  });

  it('omits the missing hint when nothing is missing', async () => {
    const alpha = await makeProject('alpha');
    expect(await formatProjectTable([alpha], null)).not.toContain('paper-camp rm');
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

function captureLogs() {
  const lines: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  return {
    get output() {
      return lines.join('\n');
    },
    restore() {
      logSpy.mockRestore();
    },
  };
}

describe('paper-camp start / stop / restart / status / ls / logs', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];
  const children: ChildProcess[] = [];
  let originalConfigDir: string | undefined;
  const originalPath = process.env.PATH;

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
    for (const child of children.splice(0)) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    // biome-ignore lint/performance/noDelete: an undefined assignment stringifies to "undefined" on process.env, unlike a plain object.
    if (originalConfigDir === undefined) delete process.env.PAPERCAMP_CONFIG_DIR;
    else process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
    process.env.PATH = originalPath;
    vi.unstubAllGlobals();
  });

  /** Only the npm registry URL is faked — everything else (the daemon's own
   *  localhost port probes) reaches the real `fetch`, so this can run
   *  alongside tests that spawn a real daemon. */
  function stubRegistryFetch(latestVersion: string, ok = true): void {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.startsWith('https://registry.npmjs.org/')) {
          return Promise.resolve({
            ok,
            json: async () => ({ version: latestVersion }),
          } as Response);
        }
        return originalFetch(input, init);
      }),
    );
  }

  async function stubNpm(script: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-npm-'));
    dirs.push(dir);
    await writeFile(join(dir, 'npm'), `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = `${dir}:${originalPath}`;
  }

  async function makeTempConfigDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-start-test-'));
    dirs.push(dir);
    return dir;
  }

  /** Points `PAPERCAMP_CONFIG_DIR` at a fresh throwaway directory for the
   * in-process command functions to read, the same redirection the CLI
   * process used to get via its own env — restored in `afterEach`. */
  async function makeConfigDir(): Promise<string> {
    const dir = await makeTempConfigDir();
    originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
    process.env.PAPERCAMP_CONFIG_DIR = dir;
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

  async function makeProjectDir(name: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-start-test-project-'));
    dirs.push(dir);
    const projectPath = join(dir, name);
    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(join(projectPath, 'papercamp', 'config.json'), '{}', 'utf-8');
    return projectPath;
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

  /** `runStart` spawns a daemon by re-invoking this process's own entry point
   * (`process.execPath`/`process.argv[1]`) — under vitest that's node running
   * this test file, not bun running the CLI. Pointing both at the real CLI for
   * the duration of `fn` makes that inner spawn start a genuine daemon, the
   * way it does when `runStart` is reached via the actual `paper-camp` binary. */
  async function asRealCliEntry<T>(fn: () => Promise<T>): Promise<T> {
    const originalArgv1 = process.argv[1];
    const originalExecPath = process.execPath;
    process.argv[1] = CLI_ENTRY;
    process.execPath = 'bun';
    try {
      return await fn();
    } finally {
      process.argv[1] = originalArgv1;
      process.execPath = originalExecPath;
    }
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

    const logs = captureLogs();
    const ok = await runStart({});
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('daemon running');
    expect(logs.output).toContain(`pid ${process.pid}`);
    await expect(access(join(configDir, 'daemon.log'))).rejects.toThrow();
  });

  it('prints the log and exits 1 when the spawned daemon dies before answering', async () => {
    const configDir = await makeTempConfigDir();
    const takenPort = await listenOnFreePort();

    const result = spawnSync('bun', [CLI_ENTRY, 'start', '-p', String(takenPort)], {
      encoding: 'utf-8',
      env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
      timeout: 15_000,
    });

    expect(result.status).toBe(1);
    const log = await readFile(join(configDir, 'daemon.log'), 'utf-8');
    expect(log.length).toBeGreaterThan(0);
    expect(result.stdout).toContain(log.trim());
  });

  it('stop reports nothing running and exits 0 when there is no daemon', async () => {
    await makeConfigDir();

    const logs = captureLogs();
    const ok = await runStop();
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('paper-camp: daemon is not running');
  });

  it('stop sends SIGTERM, waits for exit, and removes the state file', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir);

    const logs = captureLogs();
    const ok = await runStop();
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    await expect(access(join(configDir, 'daemon.json'))).rejects.toThrow();
  });

  it('stop escalates to SIGKILL when the daemon ignores SIGTERM, then removes the state file', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir, { ignoreSigterm: true });

    const logs = captureLogs();
    const ok = await runStop();
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    await expect(access(join(configDir, 'daemon.json'))).rejects.toThrow();
  }, 10_000);

  it('restart stops the running daemon, then starts a new one on the same port', async () => {
    const configDir = await makeConfigDir();
    const state = await spawnFakeDaemon(configDir);

    const logs = captureLogs();
    const ok = await asRealCliEntry(() => runRestart());
    logs.restore();

    expect(logs.output).toContain('paper-camp: daemon stopped');
    expect(isProcessAlive(state.pid)).toBe(false);
    expect(ok).toBe(true);

    await runStop();
  }, 15_000);

  describe('runUpdate', () => {
    it('reports already on the current version when nothing newer is published', async () => {
      await makeConfigDir();
      stubRegistryFetch(PAPER_CAMP_VERSION);

      const logs = captureLogs();
      const ok = await runUpdate();
      logs.restore();

      expect(ok).toBe(true);
      expect(logs.output).toBe(`paper-camp: already on ${PAPER_CAMP_VERSION}`);
    });

    it('reports a registry failure without touching npm', async () => {
      await makeConfigDir();
      stubRegistryFetch(PAPER_CAMP_VERSION, false);

      const errors: string[] = [];
      const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.join(' '));
      });
      const ok = await runUpdate();
      errorSpy.mockRestore();

      expect(ok).toBe(false);
      expect(errors.join('\n')).toContain('could not reach the npm registry');
    });

    it('installs and reports the new version when nothing is running to restart', async () => {
      await makeConfigDir();
      stubRegistryFetch('9.9.9');
      await stubNpm('exit 0');

      const logs = captureLogs();
      const ok = await runUpdate(async () => '9.9.9');
      logs.restore();

      expect(ok).toBe(true);
      expect(logs.output).toContain(`paper-camp: updated ${PAPER_CAMP_VERSION} → 9.9.9`);
      expect(logs.output).not.toContain('restarting');
    });

    it('reports an install the paper-camp command cannot see, and does not restart', async () => {
      await makeConfigDir();
      stubRegistryFetch('9.9.9');
      await stubNpm('exit 0');

      const errors: string[] = [];
      const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.join(' '));
      });
      const ok = await runUpdate(async () => PAPER_CAMP_VERSION);
      errorSpy.mockRestore();

      expect(ok).toBe(false);
      expect(errors.join('\n')).toContain(`still runs ${PAPER_CAMP_VERSION}`);
    });

    it('installs and restarts the running daemon', async () => {
      const configDir = await makeConfigDir();
      const state = await spawnFakeDaemon(configDir);
      stubRegistryFetch('9.9.9');
      await stubNpm('exit 0');

      const logs = captureLogs();
      const ok = await asRealCliEntry(() => runUpdate(async () => '9.9.9'));
      logs.restore();

      expect(ok).toBe(true);
      expect(logs.output).toContain(
        `paper-camp: updated ${PAPER_CAMP_VERSION} → 9.9.9, restarting`,
      );
      expect(isProcessAlive(state.pid)).toBe(false);

      await runStop();
    }, 15_000);

    it('logs the command output and does not restart when the install fails', async () => {
      await makeConfigDir();
      stubRegistryFetch('9.9.9');
      await stubNpm('echo "404 Not Found" >&2\nexit 1');

      const errors: string[] = [];
      const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
        errors.push(args.join(' '));
      });
      const ok = await runUpdate(async () => '9.9.9');
      errorSpy.mockRestore();

      expect(ok).toBe(false);
      expect(errors.join('\n')).toContain('update to 9.9.9 failed to install');
      expect(errors.join('\n')).toContain('404 Not Found');
    });
  });

  it('ls prints "—" for every project when no daemon is running', async () => {
    const configDir = await makeConfigDir();
    const demoPath = await makeProjectDir('demo');
    await makeRegistry(configDir, [{ path: demoPath, name: 'Demo' }]);

    const logs = captureLogs();
    await runLs();
    logs.restore();

    expect(logs.output.trim()).toBe(`demo  —  ${demoPath}`);
  });

  it('ls prints missing in the STATE column and a hint to forget a deleted project', async () => {
    const configDir = await makeConfigDir();
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-start-test-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    await makeRegistry(configDir, [{ path: deletedPath, name: 'Deleted' }]);

    const logs = captureLogs();
    await runLs();
    logs.restore();

    expect(logs.output).toContain(`deleted-repo  missing  ${deletedPath}`);
    expect(logs.output).toContain(MISSING_PROJECT_HINT);
  });

  it('ls reports "No projects registered." with no daemon running and an empty registry', async () => {
    await makeConfigDir();

    const logs = captureLogs();
    await runLs();
    logs.restore();

    expect(logs.output.trim()).toBe('No projects registered.');
  });

  it('ls reports mounted/busy state per project once the daemon answers', async () => {
    const configDir = await makeConfigDir();
    const alphaPath = await makeProjectDir('alpha');
    const betaPath = await makeProjectDir('beta');
    await makeRegistry(configDir, [
      { path: alphaPath, name: 'Alpha' },
      { path: betaPath, name: 'Beta' },
    ]);
    await spawnFakeDaemon(configDir, {
      projects: [
        { slug: 'alpha', name: 'Alpha', mounted: true, busy: true, missing: false },
        { slug: 'beta', name: 'Beta', mounted: false, busy: false, missing: false },
      ],
    });

    const logs = captureLogs();
    await runLs();
    logs.restore();

    expect(logs.output.trim()).toBe(`alpha  busy  ${alphaPath}\nbeta   idle  ${betaPath}`);
  });

  it('status reports the daemon as not running, then the "—" project table', async () => {
    const configDir = await makeConfigDir();
    const demoPath = await makeProjectDir('demo');
    await makeRegistry(configDir, [{ path: demoPath, name: 'Demo' }]);

    const logs = captureLogs();
    await runStatus();
    logs.restore();

    expect(logs.output).toContain('paper-camp: daemon is not running');
    expect(logs.output).toContain(`demo  —  ${demoPath}`);
  });

  it('status reports the running daemon block, then the live project table', async () => {
    const configDir = await makeConfigDir();
    const demoPath = await makeProjectDir('demo');
    await makeRegistry(configDir, [{ path: demoPath, name: 'Demo' }]);
    const state = await spawnFakeDaemon(configDir, {
      projects: [{ slug: 'demo', name: 'Demo', mounted: true, busy: false, missing: false }],
    });

    const logs = captureLogs();
    await runStatus();
    logs.restore();

    expect(logs.output).toContain(`paper-camp: daemon running — pid ${state.pid}`);
    expect(logs.output).toContain(`demo  mounted  ${demoPath}`);
  });

  it('status lists every link the daemon recorded at startup', async () => {
    const configDir = await makeConfigDir();
    const port = await listenOnFreePort();
    await writeDaemonState(join(configDir, 'daemon.json'), {
      pid: process.pid,
      port,
      version: '0.27.0',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: true,
      links: {
        host: 'https://paper-camp.vercel.app/?machine=http://localhost:4333&token=t',
        tailnet: 'https://paper-camp.vercel.app/?machine=https://box.tailnet.ts.net/&token=t',
      },
    });

    const logs = captureLogs();
    await runStatus();
    logs.restore();

    expect(logs.output).toContain(
      'This host  https://paper-camp.vercel.app/?machine=http://localhost:4333&token=t',
    );
    expect(logs.output).toContain(
      'Tailnet    https://paper-camp.vercel.app/?machine=https://box.tailnet.ts.net/&token=t',
    );
    expect(logs.output).not.toContain('Network');
    expect(logs.output).not.toContain('Tunnel');
  });

  it('logs says so and exits 0 when there is no daemon.log yet', async () => {
    await makeConfigDir();

    const logs = captureLogs();
    await runLogs({});
    logs.restore();

    expect(logs.output.trim()).toBe('paper-camp: no daemon.log yet');
  });

  it('logs -f also exits 0 immediately when there is no daemon.log yet', async () => {
    await makeConfigDir();

    const logs = captureLogs();
    await runLogs({ follow: true });
    logs.restore();

    expect(logs.output.trim()).toBe('paper-camp: no daemon.log yet');
  });

  it('logs defaults to printing the last 50 lines of daemon.log', async () => {
    const configDir = await makeConfigDir();
    const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`);
    await writeFile(join(configDir, 'daemon.log'), `${lines.join('\n')}\n`, 'utf-8');

    const logs = captureLogs();
    await runLogs({});
    logs.restore();

    const printed = logs.output.trim().split('\n');
    expect(printed).toHaveLength(50);
    expect(printed[0]).toBe('line 10');
    expect(printed.at(-1)).toBe('line 59');
  });

  it('logs -n limits the printed lines to the requested count', async () => {
    const configDir = await makeConfigDir();
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    await writeFile(join(configDir, 'daemon.log'), `${lines.join('\n')}\n`, 'utf-8');

    const logs = captureLogs();
    await runLogs({ lines: 3 });
    logs.restore();

    expect(logs.output.trim()).toBe('line 7\nline 8\nline 9');
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
    const configDir = await makeTempConfigDir();
    const logPath = join(configDir, 'daemon.log');
    await writeFile(logPath, 'line 1\n', 'utf-8');

    // A minimal script calling `runLogs` directly, not the full CLI entry — this
    // test only needs a real, killable process for the follow loop, not another
    // pass through commander's argument parsing.
    const child = spawn(
      'bun',
      [
        '-e',
        `import(${JSON.stringify(join(__dirname, 'daemon-lifecycle.ts'))}).then((m) => m.runLogs({ follow: true }));`,
      ],
      { env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir } },
    );
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
