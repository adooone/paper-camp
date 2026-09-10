import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runScan } from './index';
import { readNightConfig, resolveNightConfig, runNight } from './night-command';

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
});
