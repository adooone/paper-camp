import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type DaemonState,
  daemonLogPath,
  daemonStatePath,
  fetchMachineProjects,
  formatDaemonStatusLine,
  isProcessAlive,
  probeMachineEndpoint,
  readRunningDaemonState,
  removeDaemonState,
} from '../core/daemon-state';
import {
  type MachineProject,
  defaultRegistryPath,
  isProjectMissing,
  listProjects,
  loadRegistry,
} from '../core/machine-registry';
import type { MachineProjectSummary } from '../types/index';
import { DEFAULT_DAEMON_PORT } from './daemon-server';

export interface StartOptions {
  port?: number;
  share?: boolean;
  tailnet?: boolean;
}

const START_POLL_TIMEOUT_MS = 10_000;
const START_POLL_INTERVAL_MS = 200;
const BANNER_POLL_TIMEOUT_MS = 10_000;
const STOP_GRACE_MS = 5_000;
const STOP_KILL_TIMEOUT_MS = 2_000;

export function buildDaemonArgs({ port, share, tailnet }: StartOptions): string[] {
  const args = ['daemon'];
  if (port !== undefined) args.push('-p', String(port));
  if (share) args.push('--share');
  if (tailnet) args.push('--tailnet');
  return args;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDaemon(
  port: number,
  child: ChildProcess,
  timeoutMs: number,
): Promise<'ready' | 'exited' | 'timeout'> {
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  child.once('error', () => {
    exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) return 'exited';
    if (await probeMachineEndpoint(port)) return 'ready';
    await sleep(START_POLL_INTERVAL_MS);
  }
  return exited ? 'exited' : 'timeout';
}

/** --tailnet/--share each print their own banner line (or an error mentioning
 * the same words) a few seconds after "Local:", once their subprocess reports back. */
function pendingBannerMarkers(opts: StartOptions): RegExp[] {
  const markers = [/Local:/];
  if (opts.tailnet) markers.push(/tailnet|tailscale/i);
  if (opts.share) markers.push(/Tunnel:/);
  return markers;
}

async function waitForBannerLines(
  logPath: string,
  markers: RegExp[],
  child: ChildProcess,
  timeoutMs: number,
): Promise<void> {
  let exited = false;
  const onExit = () => {
    exited = true;
  };
  child.once('exit', onExit);
  child.once('error', onExit);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !exited) {
    const content = await readFile(logPath, 'utf-8').catch(() => '');
    if (markers.every((marker) => marker.test(content))) break;
    await sleep(START_POLL_INTERVAL_MS);
  }
  child.off('exit', onExit);
  child.off('error', onExit);
}

async function printLog(logPath: string): Promise<void> {
  const content = await readFile(logPath, 'utf-8').catch(() => '');
  if (content) console.log(content.trimEnd());
}

/** Spawns `paper-camp daemon` by re-invoking this same process's own entry
 * point with different argv — whatever ran `start` (bun on a `.ts` file, node
 * on the built `dist/cli/index.js`) is what spawns the daemon too. */
export async function runStart(opts: StartOptions): Promise<boolean> {
  const statePath = daemonStatePath();
  const running = await readRunningDaemonState(statePath);
  if (running) {
    console.log(formatDaemonStatusLine(running));
    return true;
  }

  const entry = process.argv[1];
  if (!entry) {
    console.error('paper-camp: could not resolve its own entry point to spawn the daemon');
    return false;
  }

  const logPath = daemonLogPath();
  mkdirSync(dirname(logPath), { recursive: true });
  const fd = openSync(logPath, 'w');
  const child = spawn(process.execPath, [entry, ...buildDaemonArgs(opts)], {
    detached: true,
    stdio: ['ignore', fd, fd],
    cwd: process.cwd(),
  });
  closeSync(fd);
  child.unref();

  const port = opts.port ?? DEFAULT_DAEMON_PORT;
  const result = await waitForDaemon(port, child, START_POLL_TIMEOUT_MS);
  if (result === 'exited') {
    await printLog(logPath);
    return false;
  }
  if (result === 'timeout') {
    console.error(
      'paper-camp: daemon did not answer within 10s but may still be starting — check `paper-camp status`.',
    );
    return false;
  }

  await waitForBannerLines(logPath, pendingBannerMarkers(opts), child, BANNER_POLL_TIMEOUT_MS);
  await printLog(logPath);
  return true;
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await sleep(START_POLL_INTERVAL_MS);
  }
  return !isProcessAlive(pid);
}

export async function runStop(): Promise<boolean> {
  const statePath = daemonStatePath();
  const running = await readRunningDaemonState(statePath);
  if (!running) {
    console.log('paper-camp: daemon is not running');
    return true;
  }

  try {
    process.kill(running.pid, 'SIGTERM');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
      await removeDaemonState(statePath);
      console.log('paper-camp: daemon is not running');
      return true;
    }
    console.error(`paper-camp: could not stop daemon (pid ${running.pid}): ${error}`);
    return false;
  }

  let exited = await waitForExit(running.pid, STOP_GRACE_MS);
  if (!exited) {
    try {
      process.kill(running.pid, 'SIGKILL');
    } catch {
      exited = true;
    }
    exited = exited || (await waitForExit(running.pid, STOP_KILL_TIMEOUT_MS));
  }

  if (!exited) {
    console.error(`paper-camp: could not stop daemon (pid ${running.pid} still alive)`);
    return false;
  }
  await removeDaemonState(statePath);
  console.log('paper-camp: daemon stopped');
  return true;
}

export function restartOptionsFromState(state: DaemonState | null): StartOptions {
  return state ? { port: state.port, share: state.share, tailnet: state.tailnet } : {};
}

export async function runRestart(): Promise<boolean> {
  const opts = restartOptionsFromState(await readRunningDaemonState(daemonStatePath()));

  const stopped = await runStop();
  if (!stopped) return false;
  return runStart(opts);
}

interface LiveProjects {
  state: DaemonState | null;
  projects: MachineProjectSummary[] | null;
}

async function fetchLiveProjects(): Promise<LiveProjects> {
  const state = await readRunningDaemonState(daemonStatePath());
  const projects = state ? await fetchMachineProjects(state.port) : null;
  return { state, projects };
}

export type ProjectState = 'mounted' | 'busy' | 'idle' | 'missing' | '—';

export async function projectState(
  project: MachineProject,
  liveProjects: MachineProjectSummary[] | null,
): Promise<ProjectState> {
  if (await isProjectMissing(project.path)) return 'missing';
  if (!liveProjects) return '—';
  const live = liveProjects.find((p) => p.slug === project.slug);
  if (!live) return 'idle';
  if (live.busy) return 'busy';
  return live.mounted ? 'mounted' : 'idle';
}

export const MISSING_PROJECT_HINT =
  "paper-camp: a missing project isn't removed automatically — run `paper-camp rm <slug>` to forget it.";

export async function formatProjectTable(
  projects: MachineProject[],
  liveProjects: MachineProjectSummary[] | null,
): Promise<string> {
  if (projects.length === 0) return 'No projects registered.';
  const rows = await Promise.all(
    projects.map(async (project) => ({
      slug: project.slug,
      state: await projectState(project, liveProjects),
      path: project.path,
    })),
  );
  const slugWidth = Math.max(...rows.map((row) => row.slug.length));
  const stateWidth = Math.max(...rows.map((row) => row.state.length));
  const table = rows
    .map((row) => `${row.slug.padEnd(slugWidth)}  ${row.state.padEnd(stateWidth)}  ${row.path}`)
    .join('\n');
  return rows.some((row) => row.state === 'missing')
    ? `${table}\n\n${MISSING_PROJECT_HINT}`
    : table;
}

export async function runLs(): Promise<void> {
  const { projects: liveProjects } = await fetchLiveProjects();
  const registry = await loadRegistry(defaultRegistryPath());
  console.log(await formatProjectTable(listProjects(registry), liveProjects));
}

export async function runStatus(): Promise<void> {
  const { state, projects: liveProjects } = await fetchLiveProjects();
  console.log(state ? formatDaemonStatusLine(state) : 'paper-camp: daemon is not running');
  const registry = await loadRegistry(defaultRegistryPath());
  console.log(await formatProjectTable(listProjects(registry), liveProjects));
}

export const DEFAULT_LOG_LINES = 50;
const LOGS_POLL_INTERVAL_MS = 200;

/** Drops the trailing empty element `split` leaves for a file ending in a
 * newline, so a 50-line request doesn't come back as 49 lines plus a blank. */
export function lastLines(content: string, n: number): string[] {
  const lines = content.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}

export interface LogsOptions {
  lines?: number;
  follow?: boolean;
}

export async function runLogs(opts: LogsOptions): Promise<void> {
  const logPath = daemonLogPath();
  const content = await readFile(logPath, 'utf-8').catch(() => null);
  if (content === null) {
    console.log('paper-camp: no daemon.log yet');
    return;
  }

  for (const line of lastLines(content, opts.lines ?? DEFAULT_LOG_LINES)) console.log(line);
  if (!opts.follow) return;

  // A follower outlives the shell or test that spawned it unless it watches for
  // that itself; `process.ppid` is read once at startup under Bun, so the parent
  // is probed with a zero signal instead.
  const parentPid = process.ppid;
  process.stdout.on('error', () => process.exit(0));
  let printedLength = content.length;
  for (;;) {
    await sleep(LOGS_POLL_INTERVAL_MS);
    if (!isProcessAlive(parentPid) || process.stdout.destroyed) return;
    const latest = await readFile(logPath, 'utf-8').catch(() => '');
    if (latest.length < printedLength) printedLength = 0;
    if (latest.length > printedLength) {
      process.stdout.write(latest.slice(printedLength));
      printedLength = latest.length;
    }
  }
}
