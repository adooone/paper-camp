import { randomBytes } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { machineConfigDir } from '../machine-registry';

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
