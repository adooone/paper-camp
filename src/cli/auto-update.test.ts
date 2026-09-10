import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type AutoUpdateDeps,
  createAutoUpdateState,
  npmInstallArgs,
  pollForUpdate,
  runNpmInstall,
  spawnRestart,
} from './auto-update';

describe('npmInstallArgs', () => {
  it('installs the exact version globally from the scoped package', () => {
    expect(npmInstallArgs('0.29.1')).toEqual(['install', '-g', '@dendelion/paper-camp@0.29.1']);
  });
});

describe('npm binary stubbing', () => {
  const dirs: string[] = [];
  const originalPath = process.env.PATH;

  afterEach(async () => {
    process.env.PATH = originalPath;
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function stubNpm(script: string): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-npm-'));
    dirs.push(dir);
    const binPath = join(dir, 'npm');
    await writeFile(binPath, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
    process.env.PATH = `${dir}:${originalPath}`;
  }

  describe('runNpmInstall', () => {
    it('resolves ok with the combined output when the install exits 0', async () => {
      await stubNpm('echo "+ @dendelion/paper-camp@0.29.1"\nexit 0');
      const result = await runNpmInstall('0.29.1');
      expect(result).toEqual({ ok: true, output: '+ @dendelion/paper-camp@0.29.1\n' });
    });

    it('resolves not-ok with the combined output when the install fails', async () => {
      await stubNpm('echo "404 Not Found" >&2\nexit 1');
      const result = await runNpmInstall('9.9.9');
      expect(result.ok).toBe(false);
      expect(result.output).toContain('404 Not Found');
    });

    it('resolves not-ok when the npm binary is missing', async () => {
      process.env.PATH = '';
      const result = await runNpmInstall('0.29.1');
      expect(result.ok).toBe(false);
    });
  });
});

describe('spawnRestart', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  it('logs an error and spawns nothing when it cannot resolve its own entry point', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    spawnRestart(undefined);
    expect(errorSpy).toHaveBeenCalledWith(
      'paper-camp: could not resolve its own entry point to restart after updating',
    );
    errorSpy.mockRestore();
  });

  it('re-invokes the entry point with a "restart" argv, detached', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-auto-update-'));
    dirs.push(dir);
    const markerPath = join(dir, 'marker.json');
    const entryPath = join(dir, 'entry.mjs');
    await writeFile(
      entryPath,
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(markerPath)}, JSON.stringify(process.argv.slice(2)));\n`,
    );

    spawnRestart(entryPath);

    await vi.waitFor(() => access(markerPath));
  });
});

function fakeDeps(overrides: Partial<AutoUpdateDeps> = {}): AutoUpdateDeps {
  return {
    checkLatestVersion: vi.fn(),
    isBusy: vi.fn(() => false),
    runInstall: vi.fn(),
    restart: vi.fn(),
    ...overrides,
  };
}

describe('pollForUpdate', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing when already on the latest version', async () => {
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.29.1',
        latestVersion: '0.29.1',
        isNewer: false,
      }),
    });
    await pollForUpdate('0.29.1', createAutoUpdateState(), deps);
    expect(deps.isBusy).not.toHaveBeenCalled();
    expect(deps.runInstall).not.toHaveBeenCalled();
    expect(deps.restart).not.toHaveBeenCalled();
  });

  it('does nothing when the registry check fails', async () => {
    const deps = fakeDeps({ checkLatestVersion: vi.fn().mockResolvedValue(null) });
    await pollForUpdate('0.28.4', createAutoUpdateState(), deps);
    expect(deps.isBusy).not.toHaveBeenCalled();
  });

  it('logs the wait once while busy, and again only once a newer version shows up', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      isBusy: vi.fn(() => true),
    });
    const state = createAutoUpdateState();

    await pollForUpdate('0.28.4', state, deps);
    await pollForUpdate('0.28.4', state, deps);

    expect(deps.runInstall).not.toHaveBeenCalled();
    const waitLines = logSpy.mock.calls.filter(([line]) =>
      String(line).includes('waiting for the machine to go idle'),
    );
    expect(waitLines).toHaveLength(1);
    expect(waitLines[0][0]).toBe('paper-camp: update to 0.29.1 waiting for the machine to go idle');
  });

  it('installs and restarts once idle, logging the install output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      isBusy: vi.fn(() => false),
      runInstall: vi.fn().mockResolvedValue({ ok: true, output: '+ @dendelion/paper-camp@0.29.1' }),
    });

    await pollForUpdate('0.28.4', createAutoUpdateState(), deps);

    expect(deps.runInstall).toHaveBeenCalledWith('0.29.1');
    expect(deps.restart).toHaveBeenCalledOnce();
    expect(logSpy.mock.calls.map(([line]) => line)).toContain('+ @dendelion/paper-camp@0.29.1');
    expect(logSpy.mock.calls.map(([line]) => line)).toContain(
      'paper-camp: update to 0.29.1 installed, restarting',
    );
  });

  it('logs a failed install with its output and does not restart', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      isBusy: vi.fn(() => false),
      runInstall: vi.fn().mockResolvedValue({ ok: false, output: '404 Not Found' }),
    });

    await pollForUpdate('0.28.4', createAutoUpdateState(), deps);

    expect(deps.restart).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('paper-camp: update to 0.29.1 failed to install'),
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('404 Not Found'));
  });

  it('retries a failed install on the next tick rather than looping within one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      isBusy: vi.fn(() => false),
      runInstall: vi.fn().mockResolvedValue({ ok: false, output: '' }),
    });

    await pollForUpdate('0.28.4', createAutoUpdateState(), deps);

    expect(deps.runInstall).toHaveBeenCalledOnce();
  });
});
