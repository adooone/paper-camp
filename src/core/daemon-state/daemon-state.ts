import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MACHINE_PROJECTS_PATH, type MachineProjectSummary } from '../../types/index';
import { machineConfigDir } from '../machine-registry';
import { formatDuration } from '../phase-run';

export interface DaemonState {
  pid: number;
  port: number;
  version: string;
  startedAt: string;
  share: boolean;
  tailnet: boolean;
}

export function daemonStatePath(): string {
  return join(machineConfigDir(), 'daemon.json');
}

export function daemonLogPath(): string {
  return join(machineConfigDir(), 'daemon.log');
}

function isDaemonState(value: unknown): value is DaemonState {
  const v = value as Partial<DaemonState> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.pid === 'number' &&
    typeof v.port === 'number' &&
    typeof v.version === 'string' &&
    typeof v.startedAt === 'string' &&
    typeof v.share === 'boolean' &&
    typeof v.tailnet === 'boolean'
  );
}

/** Resolves `undefined` on a missing or malformed file — same first-boot and
 * stale-file shape every other config-dir reader resolves to. */
async function loadDaemonState(path: string): Promise<DaemonState | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isDaemonState(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function fetchMachineProjects(port: number): Promise<MachineProjectSummary[] | null> {
  try {
    const response = await fetch(`http://localhost:${port}${MACHINE_PROJECTS_PATH}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { projects: MachineProjectSummary[] };
    return body.projects;
  } catch {
    return null;
  }
}

/** A response at all is proof the port is a live daemon, not just a live pid
 * (pids get reused, ports get taken by something else). */
export async function probeMachineEndpoint(port: number): Promise<boolean> {
  return (await fetchMachineProjects(port)) !== null;
}

/** The one truth every lifecycle command reads: a state file, a live pid, and
 * a daemon answering on its port. Anything less is stale, so this prunes the
 * file before reporting not-running. */
export async function readRunningDaemonState(path: string): Promise<DaemonState | null> {
  const state = await loadDaemonState(path);
  const alive =
    state !== undefined && isProcessAlive(state.pid) && (await probeMachineEndpoint(state.port));
  if (!alive) {
    await removeDaemonState(path);
    return null;
  }
  return state;
}

export function formatDaemonStatusLine(state: DaemonState): string {
  const uptime = formatDuration(Date.now() - Date.parse(state.startedAt));
  const flags = [state.share && 'share', state.tailnet && 'tailnet'].filter(Boolean).join(', ');
  return (
    `paper-camp: daemon running — pid ${state.pid}, port ${state.port}, ` +
    `v${state.version}, up ${uptime}${flags ? `, ${flags}` : ''}`
  );
}

/** Written to a sibling temp path and renamed into place, so a crash mid-write
 * never leaves a stale-file reader a truncated file to trip over. */
export async function writeDaemonState(path: string, state: DaemonState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
  await rename(tmpPath, path);
}

export async function removeDaemonState(path: string): Promise<void> {
  await rm(path, { force: true });
}
