import { access, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ApplyMachineUpdateDeps,
  type AutoUpdateDeps,
  applyMachineUpdate,
  createAutoUpdateState,
  installedVersionAt,
  npmInstallArgs,
  pollForUpdate,
  resolveNpmCommand,
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
    installedVersion: vi.fn().mockResolvedValue('0.29.1'),
    restart: vi.fn(),
    recordCheck: vi.fn(),
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
    expect(deps.recordCheck).toHaveBeenCalledWith({ pendingVersion: null, failedVersion: null });
  });

  it('does nothing when the registry check fails', async () => {
    const deps = fakeDeps({ checkLatestVersion: vi.fn().mockResolvedValue(null) });
    await pollForUpdate('0.28.4', createAutoUpdateState(), deps);
    expect(deps.isBusy).not.toHaveBeenCalled();
    expect(deps.recordCheck).toHaveBeenCalledWith({ pendingVersion: null, failedVersion: null });
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
    expect(deps.recordCheck).toHaveBeenCalledTimes(2);
    expect(deps.recordCheck).toHaveBeenCalledWith({
      pendingVersion: '0.29.1',
      failedVersion: null,
    });
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
    expect(deps.recordCheck).toHaveBeenLastCalledWith({
      pendingVersion: null,
      failedVersion: null,
    });
  });

  it('records a version the entry point still cannot see as failed, skips it, and never restarts', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      runInstall: vi.fn().mockResolvedValue({ ok: true, output: '' }),
      installedVersion: vi.fn().mockResolvedValue('0.28.4'),
    });
    const state = createAutoUpdateState();

    await pollForUpdate('0.28.4', state, deps);
    await pollForUpdate('0.28.4', state, deps);

    expect(deps.runInstall).toHaveBeenCalledOnce();
    expect(deps.restart).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('still on 0.28.4'));
    expect(deps.recordCheck).toHaveBeenLastCalledWith({
      pendingVersion: null,
      failedVersion: '0.29.1',
    });
  });

  it('holds the restart when a run started during the install, and restarts without reinstalling once idle', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let busy = false;
    const deps = fakeDeps({
      checkLatestVersion: vi.fn().mockResolvedValue({
        currentVersion: '0.28.4',
        latestVersion: '0.29.1',
        isNewer: true,
      }),
      isBusy: vi.fn(() => busy),
      runInstall: vi.fn(async () => {
        busy = true;
        return { ok: true, output: '' };
      }),
    });
    const state = createAutoUpdateState();

    await pollForUpdate('0.28.4', state, deps);
    expect(deps.restart).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.map(([line]) => line)).toContain(
      'paper-camp: update to 0.29.1 installed, restart waiting for the machine to go idle',
    );
    expect(deps.recordCheck).toHaveBeenLastCalledWith({
      pendingVersion: '0.29.1',
      failedVersion: null,
    });

    busy = false;
    await pollForUpdate('0.28.4', state, deps);
    expect(deps.runInstall).toHaveBeenCalledOnce();
    expect(deps.restart).toHaveBeenCalledOnce();
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

function fakeApplyDeps(overrides: Partial<ApplyMachineUpdateDeps> = {}): ApplyMachineUpdateDeps {
  return {
    installedVersion: vi.fn().mockResolvedValue('0.28.4'),
    runInstall: vi.fn().mockResolvedValue({ ok: true, output: '' }),
    isBusy: vi.fn(() => false),
    restart: vi.fn(),
    ...overrides,
  };
}

describe('applyMachineUpdate', () => {
  it('reports already current without installing when the version is already live', async () => {
    const deps = fakeApplyDeps({ installedVersion: vi.fn().mockResolvedValue('0.29.1') });
    expect(await applyMachineUpdate('0.29.1', deps)).toEqual({ outcome: 'already current' });
    expect(deps.runInstall).not.toHaveBeenCalled();
  });

  it('installs and restarts when idle', async () => {
    const deps = fakeApplyDeps({
      installedVersion: vi.fn().mockResolvedValueOnce('0.28.4').mockResolvedValueOnce('0.29.1'),
    });
    expect(await applyMachineUpdate('0.29.1', deps)).toEqual({ outcome: 'installed' });
    expect(deps.runInstall).toHaveBeenCalledWith('0.29.1');
    expect(deps.restart).toHaveBeenCalledOnce();
  });

  it('installs but holds the restart while the machine is busy', async () => {
    const deps = fakeApplyDeps({
      installedVersion: vi.fn().mockResolvedValueOnce('0.28.4').mockResolvedValueOnce('0.29.1'),
      isBusy: vi.fn(() => true),
    });
    expect(await applyMachineUpdate('0.29.1', deps)).toEqual({ outcome: 'waiting for idle' });
    expect(deps.runInstall).toHaveBeenCalledWith('0.29.1');
    expect(deps.restart).not.toHaveBeenCalled();
  });

  it('reports failed with the install output when the install fails', async () => {
    const deps = fakeApplyDeps({
      runInstall: vi.fn().mockResolvedValue({ ok: false, output: '404 Not Found' }),
    });
    expect(await applyMachineUpdate('0.29.1', deps)).toEqual({
      outcome: 'failed',
      output: '404 Not Found',
    });
    expect(deps.restart).not.toHaveBeenCalled();
  });

  it('reports failed when the install lands in a prefix the entry point does not run from', async () => {
    const deps = fakeApplyDeps({
      installedVersion: vi.fn().mockResolvedValue('0.28.4'),
    });
    const result = await applyMachineUpdate('0.29.1', deps);
    expect(result.outcome).toBe('failed');
    expect(result.output).toContain('still on 0.28.4');
    expect(deps.restart).not.toHaveBeenCalled();
  });
});

describe('resolveNpmCommand', () => {
  it('prefers the Volta shim when it exists', () => {
    expect(resolveNpmCommand({ VOLTA_HOME: '/v' }, (path) => path === '/v/bin/npm')).toBe(
      '/v/bin/npm',
    );
  });

  it('falls back to PATH lookup without Volta', () => {
    expect(resolveNpmCommand({}, () => false)).toBe('npm');
  });
});

describe('installedVersionAt', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  it('reads the version from the package above the entry, following a bin symlink', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-entry-'));
    dirs.push(dir);
    await mkdir(join(dir, 'pkg', 'dist', 'cli'), { recursive: true });
    await writeFile(join(dir, 'pkg', 'package.json'), JSON.stringify({ version: '0.29.1' }));
    await writeFile(join(dir, 'pkg', 'dist', 'cli', 'index.js'), '');
    await mkdir(join(dir, 'bin'));
    await symlink(join(dir, 'pkg', 'dist', 'cli', 'index.js'), join(dir, 'bin', 'paper-camp'));
    expect(await installedVersionAt(join(dir, 'bin', 'paper-camp'))).toBe('0.29.1');
  });

  it('resolves null for a missing entry', async () => {
    expect(await installedVersionAt('/nowhere/paper-camp')).toBeNull();
    expect(await installedVersionAt(undefined)).toBeNull();
  });
});
