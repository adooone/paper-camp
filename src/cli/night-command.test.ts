import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { writeDaemonState } from '../core/daemon-state';
import { MACHINE_NIGHT_PATH, MACHINE_PROJECTS_PATH } from '../types/index';
import { runScan } from './index';
import { readNightConfig, resolveNightConfig, runNight } from './night-command';
import { runNightChunkPass } from './night-pass';

vi.mock('./night-pass', () => ({ runNightChunkPass: vi.fn() }));

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

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

function captureErrors() {
  const lines: string[] = [];
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  return {
    get output() {
      return lines.join('\n');
    },
    restore() {
      errSpy.mockRestore();
    },
  };
}

let originalConfigDir: string | undefined;

afterEach(() => {
  // biome-ignore lint/performance/noDelete: an undefined assignment stringifies to "undefined" on process.env, unlike a plain object.
  if (originalConfigDir === undefined) delete process.env.PAPERCAMP_CONFIG_DIR;
  else process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
});

async function useConfigDir(): Promise<string> {
  const dir = await makeTempDir('paper-camp-night-config-');
  originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
  process.env.PAPERCAMP_CONFIG_DIR = dir;
  return dir;
}

async function makeProjectDir(root: string, name: string, night?: unknown): Promise<string> {
  const projectDir = join(root, name);
  await mkdir(join(projectDir, 'papercamp'), { recursive: true });
  await writeFile(
    join(projectDir, 'papercamp', 'config.json'),
    JSON.stringify({ ...(night !== undefined && { night }) }),
    'utf-8',
  );
  return projectDir;
}

describe('resolveNightConfig', () => {
  it('fills in defaults for an undefined config', () => {
    expect(resolveNightConfig(undefined)).toEqual({
      ceiling: 50,
      floor: 70,
      maxChunks: 3,
      maxTurns: 20,
      maxCostUsd: 1,
      window: undefined,
      roots: undefined,
    });
  });

  it('keeps explicit overrides', () => {
    expect(
      resolveNightConfig({ ceiling: 40, floor: 60, maxChunks: 5, roots: ['src/app'] }),
    ).toEqual({
      ceiling: 40,
      floor: 60,
      maxChunks: 5,
      maxTurns: 20,
      maxCostUsd: 1,
      window: undefined,
      roots: ['src/app'],
    });
  });
});

describe('readNightConfig', () => {
  it('reads the night block from a project config.json', async () => {
    const root = await makeTempDir('paper-camp-night-project-');
    const projectDir = await makeProjectDir(root, 'demo', { ceiling: 40 });
    expect(await readNightConfig(projectDir)).toEqual({ ceiling: 40 });
  });

  it('is undefined when the project has no night block', async () => {
    const root = await makeTempDir('paper-camp-night-project-');
    const projectDir = await makeProjectDir(root, 'demo');
    expect(await readNightConfig(projectDir)).toBeUndefined();
  });

  it('is undefined when config.json is missing', async () => {
    const root = await makeTempDir('paper-camp-night-project-');
    expect(await readNightConfig(join(root, 'nope'))).toBeUndefined();
  });
});

describe('runNight', () => {
  it('rejects a slug that is not registered', async () => {
    await useConfigDir();
    const errors = captureErrors();
    const ok = await runNight('missing');
    errors.restore();
    expect(ok).toBe(false);
    expect(errors.output).toContain('No registered project with slug "missing"');
  });

  it('sets, reports, and clears the night project across status calls', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-scan-');
    await makeProjectDir(scanRoot, 'demo', { ceiling: 40, floor: 65, maxChunks: 2 });
    const scanLogs = captureLogs();
    await runScan(scanRoot);
    scanLogs.restore();

    const offLogs = captureLogs();
    await runNight('status');
    offLogs.restore();
    expect(offLogs.output).toContain('night shift is off');

    const setLogs = captureLogs();
    const ok = await runNight('demo');
    setLogs.restore();
    expect(ok).toBe(true);
    expect(setLogs.output).toContain('night shift set to "demo"');

    const statusLogs = captureLogs();
    await runNight('status');
    statusLogs.restore();
    expect(statusLogs.output).toContain('night shift runs for "demo"');
    expect(statusLogs.output).toContain('ceiling (5h):   40%');
    expect(statusLogs.output).toContain('floor (7d):     65%');
    expect(statusLogs.output).toContain('maxChunks:      2');
    expect(statusLogs.output).toContain('gate:           unknown — start the daemon');

    const offAgainLogs = captureLogs();
    const cleared = await runNight('off');
    offAgainLogs.restore();
    expect(cleared).toBe(true);
    expect(offAgainLogs.output).toContain('night shift turned off');

    const finalStatusLogs = captureLogs();
    await runNight('status');
    finalStatusLogs.restore();
    expect(finalStatusLogs.output).toContain('night shift is off');
  });

  it('prints the live gate from a running daemon', async () => {
    const configDir = await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-scan-');
    await makeProjectDir(scanRoot, 'demo');
    await runScan(scanRoot);
    await runNight('demo');

    const servers: Server[] = [];
    const server = createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      if (req.url === MACHINE_PROJECTS_PATH) {
        res.end(JSON.stringify({ projects: [] }));
        return;
      }
      if (req.url === MACHINE_NIGHT_PATH) {
        res.end(
          JSON.stringify({
            slug: 'demo',
            projectMissing: false,
            gate: {
              open: false,
              reasons: ['task-running'],
              fiveHourUtilizationPct: 10,
              sevenDayUtilizationPct: 20,
            },
          }),
        );
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    servers.push(server);
    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => resolve((server.address() as AddressInfo).port));
    });
    await writeDaemonState(join(configDir, 'daemon.json'), {
      pid: process.pid,
      port,
      version: '0.30.0',
      startedAt: new Date().toISOString(),
      share: false,
      tailnet: false,
    });

    try {
      const logs = captureLogs();
      await runNight('status');
      logs.restore();
      expect(logs.output).toContain('gate:           blocked — an agent task is running');
    } finally {
      await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
    }
  });
});

describe('runNight("run", chunk)', () => {
  afterEach(() => {
    vi.mocked(runNightChunkPass).mockReset();
  });

  it('requires a chunk argument', async () => {
    await useConfigDir();
    const errors = captureErrors();
    const ok = await runNight('run');
    errors.restore();
    expect(ok).toBe(false);
    expect(errors.output).toContain('Usage: paper-camp night run <chunk>');
  });

  it('fails when night shift is off', async () => {
    await useConfigDir();
    const errors = captureErrors();
    const ok = await runNight('run', 'src/core');
    errors.restore();
    expect(ok).toBe(false);
    expect(errors.output).toContain('night shift is off');
  });

  it('fails when no checks are enabled', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-run-');
    const allOff = {
      checks: {
        bugs: false,
        'dead-code': false,
        performance: false,
        tests: false,
        docs: false,
        security: false,
        a11y: false,
      },
    };
    await makeProjectDir(scanRoot, 'demo', allOff);
    await runScan(scanRoot);
    await runNight('demo');

    const errors = captureErrors();
    const ok = await runNight('run', 'src/core');
    errors.restore();
    expect(ok).toBe(false);
    expect(errors.output).toContain('no checks are enabled');
    expect(runNightChunkPass).not.toHaveBeenCalled();
  });

  it('runs the pass with the configured agent and prints confirmed findings', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-run-');
    const projectDir = join(scanRoot, 'demo');
    await mkdir(join(projectDir, 'papercamp'), { recursive: true });
    await writeFile(
      join(projectDir, 'papercamp', 'config.json'),
      JSON.stringify({
        night: { maxTurns: 5, maxCostUsd: 0.25 },
        defaultAgents: { nightShift: { agent: 'claude-code', model: 'opus', effort: 'high' } },
      }),
      'utf-8',
    );
    await writeFile(
      join(projectDir, 'papercamp', 'night.json'),
      JSON.stringify({
        chunks: [{ path: 'src/core', lastReviewedCommit: 'abc1234', lastReviewedAt: null }],
      }),
      'utf-8',
    );
    await runScan(scanRoot);
    await runNight('demo');

    vi.mocked(runNightChunkPass).mockResolvedValue({
      chunkPath: 'src/core',
      reviewedCommit: 'deadbeefdeadbeef',
      findings: [
        { file: 'src/core/a.ts', line: 3, message: 'off by one', severity: 'high', check: 'bugs' },
      ],
      usage: { numTurns: 4, costUsd: 0.12, cappedByTurns: false },
      checks: [
        {
          check: 'bugs',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:01:00.000Z',
          ok: true,
          usage: { numTurns: 4, costUsd: 0.12, cappedByTurns: false },
          findingsCount: 1,
        },
      ],
    });

    const logs = captureLogs();
    const ok = await runNight('run', 'src/core');
    logs.restore();

    expect(ok).toBe(true);
    expect(runNightChunkPass).toHaveBeenCalledWith(
      expect.objectContaining({
        root: projectDir,
        chunkPath: 'src/core',
        sinceCommit: 'abc1234',
        agentConfig: { agent: 'claude-code', model: 'opus', effort: 'high' },
        maxTurns: 5,
        maxCostUsd: 0.25,
      }),
    );
    expect(logs.output).toContain('reviewed "src/core" at deadbee');
    expect(logs.output).toContain('1 confirmed finding(s), 1 written, 0 dropped as overlap');
    expect(logs.output).toContain('[high] src/core/a.ts:3 — off by one');

    const suggestions = await readFile(join(projectDir, 'papercamp', 'suggestions.md'), 'utf-8');
    expect(suggestions).toContain('## Night findings');
    expect(suggestions).toContain('check=bugs');
    expect(suggestions).toContain('file=src/core/a.ts');
    expect(suggestions).toContain('severity=high');
    expect(suggestions).toContain('off by one');

    const tasksLog = await readFile(join(projectDir, 'papercamp', 'tasks.log'), 'utf-8');
    const taskLines = tasksLog
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(taskLines).toHaveLength(2);
    expect(taskLines[0]).toMatchObject({ taskKind: 'night-review', planTitle: 'src/core · bugs' });
    expect(taskLines[1]).toMatchObject({
      taskKind: 'night-review',
      outcome: 'done',
      usage: { costUsd: 0.12, numTurns: 4 },
    });
  });

  it('drops a finding that overlaps an open idea and does not write it', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-run-');
    const projectDir = join(scanRoot, 'demo');
    await mkdir(join(projectDir, 'papercamp', 'ideas'), { recursive: true });
    await writeFile(join(projectDir, 'papercamp', 'config.json'), '{}', 'utf-8');
    await writeFile(
      join(projectDir, 'papercamp', 'ideas', 'IDEA-1.md'),
      [
        '---',
        'id: IDEA-1',
        'title: Fix the off by one turn bug',
        'created: 2026-09-01',
        '---',
        '',
        'The off by one turn counting bug needs fixing.',
        '',
      ].join('\n'),
      'utf-8',
    );
    await runScan(scanRoot);
    await runNight('demo');

    vi.mocked(runNightChunkPass).mockResolvedValue({
      chunkPath: 'src/core',
      reviewedCommit: 'deadbeefdeadbeef',
      findings: [
        {
          file: 'src/core/a.ts',
          line: 3,
          message: 'off by one turn counting bug',
          severity: 'high',
          check: 'bugs',
        },
      ],
      usage: { numTurns: 4, costUsd: 0.12, cappedByTurns: false },
      checks: [
        {
          check: 'bugs',
          startedAt: '2026-01-01T00:00:00.000Z',
          endedAt: '2026-01-01T00:01:00.000Z',
          ok: true,
          usage: { numTurns: 4, costUsd: 0.12, cappedByTurns: false },
          findingsCount: 1,
        },
      ],
    });

    const logs = captureLogs();
    const ok = await runNight('run', 'src/core');
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('1 confirmed finding(s), 0 written, 1 dropped as overlap');

    const suggestionsPath = join(projectDir, 'papercamp', 'suggestions.md');
    const suggestions = await readFile(suggestionsPath, 'utf-8').catch(() => '');
    expect(suggestions).not.toContain('Night findings');
  });

  it('reports a thrown error rather than crashing', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-night-run-');
    await makeProjectDir(scanRoot, 'demo');
    await runScan(scanRoot);
    await runNight('demo');
    vi.mocked(runNightChunkPass).mockRejectedValue(new Error('worktree add failed'));

    const errors = captureErrors();
    const ok = await runNight('run', 'src/core');
    errors.restore();

    expect(ok).toBe(false);
    expect(errors.output).toContain('night pass failed — worktree add failed');
  });
});
