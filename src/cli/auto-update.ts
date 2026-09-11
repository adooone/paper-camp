import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, openSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { LatestVersionCheck } from '../core/registry-version';
import type { MachineUpdateResponse } from '../types/index';

export interface InstallResult {
  ok: boolean;
  output: string;
}

export function npmInstallArgs(version: string): string[] {
  return ['install', '-g', `@dendelion/paper-camp@${version}`];
}

/** Volta puts its raw npm binary ahead of its shim on a child's PATH, and only the
 *  shim installs a global into the image the `paper-camp` shim launches — so the
 *  shim is preferred when it exists; otherwise PATH lookup finds the manager that
 *  installed this daemon in the first place. */
export function resolveNpmCommand(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
): string {
  const voltaShim = join(env.VOLTA_HOME ?? join(homedir(), '.volta'), 'bin', 'npm');
  return exists(voltaShim) ? voltaShim : 'npm';
}

export function runNpmInstall(version: string): Promise<InstallResult> {
  return new Promise((resolve) => {
    const proc = spawn(resolveNpmCommand(), npmInstallArgs(version), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    proc.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.on('close', (code) => resolve({ ok: code === 0, output }));
    proc.on('error', (error) => resolve({ ok: false, output: error.message }));
  });
}

/** Re-invokes this same entry point's own `restart` command as a detached process
 *  instead of restarting in-process: `restart` needs to SIGTERM the running daemon,
 *  which is this process, so it cannot stop itself and then start the replacement —
 *  it would die before reaching the second half. */
export function spawnRestart(entry: string | undefined, logPath?: string): void {
  if (!entry) {
    console.error('paper-camp: could not resolve its own entry point to restart after updating');
    return;
  }
  const out = logPath ? openSync(logPath, 'a') : 'ignore';
  const child: ChildProcess = spawn(process.execPath, [entry, 'restart'], {
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.unref();
}

/** The version the daemon's own entry point would run next — read from the
 *  package.json above it, following the bin symlink, so an install that landed in
 *  some other prefix shows up as "still on the old version". */
export async function installedVersionAt(entry: string | undefined): Promise<string | null> {
  if (!entry) return null;
  let dir: string;
  try {
    dir = dirname(realpathSync(entry));
  } catch {
    return null;
  }
  while (true) {
    const raw = await readFile(join(dir, 'package.json'), 'utf-8').catch(() => null);
    if (raw) {
      try {
        const version = (JSON.parse(raw) as { version?: string }).version;
        if (typeof version === 'string') return version;
      } catch {}
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface ApplyMachineUpdateDeps {
  installedVersion: () => Promise<string | null>;
  runInstall: (version: string) => Promise<InstallResult>;
  isBusy: () => boolean;
  restart: () => void;
}

/** The Publish workflow already knows the version, so this skips straight to
 *  installing it — through the same shim, verified the same way, holding only
 *  the restart while the machine is busy rather than holding off the install
 *  itself, since a webhook gets one shot. */
export async function applyMachineUpdate(
  version: string,
  deps: ApplyMachineUpdateDeps,
): Promise<MachineUpdateResponse> {
  const current = await deps.installedVersion();
  if (current === version) return { outcome: 'already current' };

  const result = await deps.runInstall(version);
  const output = result.output.trim();
  if (!result.ok) return { outcome: 'failed', output };

  const installed = await deps.installedVersion();
  if (installed !== version) {
    return {
      outcome: 'failed',
      output: `installed, but this daemon's entry point is still on ${installed ?? 'an unknown version'}`,
    };
  }

  if (deps.isBusy()) return { outcome: 'waiting for idle' };
  deps.restart();
  return { outcome: 'installed' };
}

export type BootUpdateCheck =
  | { newerFound: false }
  | { newerFound: true; version: string; result: MachineUpdateResponse };

/** The one npm check a boot makes (IDEA-258, replacing the thirty-minute poll):
 *  a release published while this machine was off, or while its daemon was
 *  down, installs on the next boot instead of waiting on a retry tick that no
 *  longer exists. `apply` is the same install-and-restart path a webhook call
 *  runs, so a busy machine holds one restart no matter which caller asked. */
/** Set by the smoke tests and anyone running a throwaway daemon from a checkout that
 *  is behind npm, where the boot check would otherwise replace the global install. */
export function skipsUpdateCheck(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.PAPERCAMP_SKIP_UPDATE_CHECK === '1';
}

export async function checkForUpdateAtBoot(
  currentVersion: string,
  checkLatestVersion: (currentVersion: string) => Promise<LatestVersionCheck | null>,
  apply: (version: string) => Promise<MachineUpdateResponse>,
): Promise<BootUpdateCheck> {
  const check = await checkLatestVersion(currentVersion);
  if (!check || !check.isNewer) return { newerFound: false };
  const result = await apply(check.latestVersion);
  return { newerFound: true, version: check.latestVersion, result };
}
