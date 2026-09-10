import { type ChildProcess, spawn } from 'node:child_process';
import { type LatestVersionCheck, checkLatestVersion } from '../core/registry-version';

export const AUTO_UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;

export interface InstallResult {
  ok: boolean;
  output: string;
}

export function npmInstallArgs(version: string): string[] {
  return ['install', '-g', `@dendelion/paper-camp@${version}`];
}

/** No absolute path to `npm` is hardcoded — plain PATH lookup resolves to
 *  whichever manager (Volta, nvm, system) installed this daemon in the first
 *  place, the same one that should install the next version too. */
export function runNpmInstall(version: string): Promise<InstallResult> {
  return new Promise((resolve) => {
    const proc = spawn('npm', npmInstallArgs(version), { stdio: ['ignore', 'pipe', 'pipe'] });
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
export function spawnRestart(entry: string | undefined): void {
  if (!entry) {
    console.error('paper-camp: could not resolve its own entry point to restart after updating');
    return;
  }
  const child: ChildProcess = spawn(process.execPath, [entry, 'restart'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export interface AutoUpdateDeps {
  checkLatestVersion: (currentVersion: string) => Promise<LatestVersionCheck | null>;
  isBusy: () => boolean;
  runInstall: (version: string) => Promise<InstallResult>;
  restart: () => void;
}

export interface AutoUpdateState {
  waitingForIdleVersion: string | null;
}

export function createAutoUpdateState(): AutoUpdateState {
  return { waitingForIdleVersion: null };
}

/** One poll tick: check, then either log the once-per-pending-version wait, install
 *  and restart, or log a failed install for the next tick to retry — never installs
 *  twice for the same pending version and never loops retrying within a single tick. */
export async function pollForUpdate(
  currentVersion: string,
  state: AutoUpdateState,
  deps: AutoUpdateDeps,
): Promise<void> {
  const check = await deps.checkLatestVersion(currentVersion);
  if (!check || !check.isNewer) {
    state.waitingForIdleVersion = null;
    return;
  }

  if (deps.isBusy()) {
    if (state.waitingForIdleVersion !== check.latestVersion) {
      console.log(
        `paper-camp: update to ${check.latestVersion} waiting for the machine to go idle`,
      );
      state.waitingForIdleVersion = check.latestVersion;
    }
    return;
  }
  state.waitingForIdleVersion = null;

  const result = await deps.runInstall(check.latestVersion);
  const output = result.output.trim();
  if (!result.ok) {
    console.error(
      `paper-camp: update to ${check.latestVersion} failed to install, will retry on the next poll${output ? `\n${output}` : ''}`,
    );
    return;
  }
  if (output) console.log(output);
  console.log(`paper-camp: update to ${check.latestVersion} installed, restarting`);
  deps.restart();
}

export function startAutoUpdatePolling(currentVersion: string, isBusy: () => boolean): () => void {
  const state = createAutoUpdateState();
  const deps: AutoUpdateDeps = {
    checkLatestVersion,
    isBusy,
    runInstall: runNpmInstall,
    restart: () => spawnRestart(process.argv[1]),
  };
  const tick = () => void pollForUpdate(currentVersion, state, deps);
  const timer = setInterval(tick, AUTO_UPDATE_POLL_INTERVAL_MS);
  tick();
  return () => clearInterval(timer);
}
