import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { runLs } from './daemon-lifecycle';
import { runInit, runRm, runScan } from './index';

const CLI_ENTRY = join(__dirname, 'index.ts');

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

async function makeProjectDir(root: string, name: string, hasConfig: boolean): Promise<void> {
  const projectDir = join(root, name);
  if (hasConfig) {
    await mkdir(join(projectDir, 'papercamp'), { recursive: true });
    await writeFile(join(projectDir, 'papercamp', 'config.json'), '{}', 'utf-8');
  } else {
    await mkdir(projectDir, { recursive: true });
  }
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
  const dir = await makeTempDir('paper-camp-config-');
  originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
  process.env.PAPERCAMP_CONFIG_DIR = dir;
  return dir;
}

describe('paper-camp scan / ls / rm / init', () => {
  it('scan skips a directory with no papercamp/config.json and registers the rest', async () => {
    const configDir = await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-scan-');
    await makeProjectDir(scanRoot, 'with-config', true);
    await makeProjectDir(scanRoot, 'without-config', false);

    const logs = captureLogs();
    const ok = await runScan(scanRoot);
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toContain('Added:');
    expect(logs.output).toContain('with-config');
    expect(logs.output).toContain('Skipped:');
    expect(logs.output).toContain('without-config — no papercamp/config.json');

    const registry = JSON.parse(await readFile(join(configDir, 'projects.json'), 'utf-8'));
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]).toMatchObject({
      slug: 'with-config',
      path: join(scanRoot, 'with-config'),
    });
  });

  it('ls reports no projects against a fresh registry, then lists what scan added', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-scan-');

    const emptyLogs = captureLogs();
    await runLs();
    emptyLogs.restore();
    expect(emptyLogs.output).toContain('No projects registered.');

    await makeProjectDir(scanRoot, 'demo', true);
    await runScan(scanRoot);

    const logs = captureLogs();
    await runLs();
    logs.restore();
    expect(logs.output).toContain('demo');
    expect(logs.output).toContain(join(scanRoot, 'demo'));
  });

  it('rm removes a registered project and fails for an unknown slug', async () => {
    await useConfigDir();
    const scanRoot = await makeTempDir('paper-camp-scan-');
    await makeProjectDir(scanRoot, 'demo', true);
    await runScan(scanRoot);

    const removeLogs = captureLogs();
    const removed = await runRm('demo');
    removeLogs.restore();
    expect(removed).toBe(true);
    expect(removeLogs.output).toContain('Removed "demo" from the registry.');

    const afterLogs = captureLogs();
    await runLs();
    afterLogs.restore();
    expect(afterLogs.output).toContain('No projects registered.');

    const errors = captureErrors();
    const unknown = await runRm('demo');
    errors.restore();
    expect(unknown).toBe(false);
    expect(errors.output).toContain('No registered project with slug "demo"');
  });

  it('init registers the project, and stays clean if the path is already registered', async () => {
    const configDir = await useConfigDir();
    const projectDir = await makeTempDir('paper-camp-init-');

    const ok = await runInit(projectDir);
    expect(ok).toBe(true);

    const registry = JSON.parse(await readFile(join(configDir, 'projects.json'), 'utf-8'));
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]).toMatchObject({ path: projectDir });

    await rm(join(projectDir, 'papercamp', 'config.json'));
    const rerun = await runInit(projectDir);
    expect(rerun).toBe(true);

    const registryAfterRerun = JSON.parse(
      await readFile(join(configDir, 'projects.json'), 'utf-8'),
    );
    expect(registryAfterRerun.projects).toHaveLength(1);
  });
});

describe('paper-camp CLI entry point', () => {
  it('dispatches `ls` through commander to runLs against an empty registry', async () => {
    const configDir = await makeTempDir('paper-camp-config-');
    const result = spawnSync('bun', [CLI_ENTRY, 'ls'], {
      encoding: 'utf-8',
      env: { ...process.env, PAPERCAMP_CONFIG_DIR: configDir },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No projects registered.');
  });
});
