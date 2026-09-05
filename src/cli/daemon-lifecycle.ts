import { type ChildProcess, spawn } from 'node:child_process';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type DaemonState,
  daemonLogPath,
  daemonStatePath,
  formatDaemonStatusLine,
  isProcessAlive,
  probeMachineEndpoint,
  readRunningDaemonState,
  removeDaemonState,
} from '../core/daemon-state';
import { DEFAULT_DAEMON_PORT } from './daemon-server';

export interface StartOptions {
  port?: number;
  share?: boolean;
  tailnet?: boolean;
}

const START_POLL_TIMEOUT_MS = 10_000;
const START_POLL_INTERVAL_MS = 200;
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
): Promise<'ready' | 'failed'> {
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  child.once('error', () => {
    exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) return 'failed';
    if (await probeMachineEndpoint(port)) return 'ready';
    await sleep(START_POLL_INTERVAL_MS);
  }
  return 'failed';
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
  if (result === 'failed') {
    await printLog(logPath);
    return false;
  }

  await sleep(START_POLL_INTERVAL_MS);
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

  process.kill(running.pid, 'SIGTERM');
  let exited = await waitForExit(running.pid, STOP_GRACE_MS);
  if (!exited) {
    try {
      process.kill(running.pid, 'SIGKILL');
    } catch {
      exited = true;
    }
    exited = exited || (await waitForExit(running.pid, STOP_KILL_TIMEOUT_MS));
  }

  await removeDaemonState(statePath);
  if (!exited) {
    console.error(`paper-camp: could not stop daemon (pid ${running.pid} still alive)`);
    return false;
  }
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
