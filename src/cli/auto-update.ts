import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync, openSync, realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { type LatestVersionCheck, checkLatestVersion } from '../core/registry-version';
import type { MachineUpdateResponse } from '../types/index';

export const AUTO_UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;

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

/** The Publish workflow already knows the version, so this skips the registry
 *  check `pollForUpdate` opens with and installs it directly — through the same
 *  shim, verified the same way, holding only the restart while the machine is
 *  busy rather than holding off the install itself, since a webhook gets one shot. */
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

export interface AutoUpdateCheckRecord {
  pendingVersion: string | null;
  failedVersion: string | null;
}

export interface AutoUpdateDeps {
  checkLatestVersion: (currentVersion: string) => Promise<LatestVersionCheck | null>;
  isBusy: () => boolean;
  runInstall: (version: string) => Promise<InstallResult>;
  installedVersion: () => Promise<string | null>;
  restart: () => void;
  recordCheck: (record: AutoUpdateCheckRecord) => void | Promise<void>;
}

export interface AutoUpdateState {
  waitingForIdleVersion: string | null;
  installedAwaitingRestart: string | null;
  failedVersion: string | null;
}

export function createAutoUpdateState(): AutoUpdateState {
  return { waitingForIdleVersion: null, installedAwaitingRestart: null, failedVersion: null };
}

/** One poll tick: check, then either log the once-per-pending-version wait, install
 *  and restart, or log a failed install for the next tick to retry — never installs
 *  twice for the same pending version and never loops retrying within a single tick.
 *  An install whose result the entry point cannot see is recorded as failed and that
 *  version is skipped, so a wrong prefix cannot turn into a restart every tick. */
export async function pollForUpdate(
  currentVersion: string,
  state: AutoUpdateState,
  deps: AutoUpdateDeps,
): Promise<void> {
  const check = await deps.checkLatestVersion(currentVersion);
  if (!check || !check.isNewer) {
    state.waitingForIdleVersion = null;
    await deps.recordCheck({ pendingVersion: null, failedVersion: state.failedVersion });
    return;
  }
  const latest = check.latestVersion;

  if (state.failedVersion === latest) {
    await deps.recordCheck({ pendingVersion: null, failedVersion: latest });
    return;
  }

  if (state.installedAwaitingRestart !== latest) {
    if (deps.isBusy()) {
      if (state.waitingForIdleVersion !== latest) {
        console.log(`paper-camp: update to ${latest} waiting for the machine to go idle`);
        state.waitingForIdleVersion = latest;
      }
      await deps.recordCheck({ pendingVersion: latest, failedVersion: null });
      return;
    }
    state.waitingForIdleVersion = null;

    const result = await deps.runInstall(latest);
    const output = result.output.trim();
    if (!result.ok) {
      console.error(
        `paper-camp: update to ${latest} failed to install, will retry on the next poll${output ? `\n${output}` : ''}`,
      );
      await deps.recordCheck({ pendingVersion: latest, failedVersion: null });
      return;
    }
    if (output) console.log(output);

    const installed = await deps.installedVersion();
    if (installed !== latest) {
      console.error(
        `paper-camp: update to ${latest} installed, but this daemon's entry point is still on ${installed ?? 'an unknown version'} — the install landed in a prefix the paper-camp command does not run from; skipping ${latest} until the next release`,
      );
      state.failedVersion = latest;
      await deps.recordCheck({ pendingVersion: null, failedVersion: latest });
      return;
    }
    state.installedAwaitingRestart = latest;
  }

  // Re-checked after the install, which takes long enough for a run to have started.
  if (deps.isBusy()) {
    if (state.waitingForIdleVersion !== latest) {
      console.log(
        `paper-camp: update to ${latest} installed, restart waiting for the machine to go idle`,
      );
      state.waitingForIdleVersion = latest;
    }
    await deps.recordCheck({ pendingVersion: latest, failedVersion: null });
    return;
  }
  await deps.recordCheck({ pendingVersion: null, failedVersion: null });
  console.log(`paper-camp: update to ${latest} installed, restarting`);
  deps.restart();
}

export function startAutoUpdatePolling(
  currentVersion: string,
  isBusy: () => boolean,
  recordCheck: (record: AutoUpdateCheckRecord) => void | Promise<void>,
  logPath?: string,
): () => void {
  const state = createAutoUpdateState();
  const deps: AutoUpdateDeps = {
    checkLatestVersion,
    isBusy,
    runInstall: runNpmInstall,
    installedVersion: () => installedVersionAt(process.argv[1]),
    restart: () => spawnRestart(process.argv[1], logPath),
    recordCheck,
  };
  const tick = () => void pollForUpdate(currentVersion, state, deps);
  const timer = setInterval(tick, AUTO_UPDATE_POLL_INTERVAL_MS);
  tick();
  return () => clearInterval(timer);
}
