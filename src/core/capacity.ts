import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RateLimitSnapshot } from '../types/index';

export type CapacitySource = 'run' | 'probe';

export interface CapacityRecord {
  snapshot: RateLimitSnapshot;
  capturedAt: string;
  source: CapacitySource;
}

function capacityPath(root: string): string {
  return join(root, 'papercamp', 'capacity.json');
}

function isCapacityRecord(value: unknown): value is CapacityRecord {
  const v = value as Partial<CapacityRecord> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.snapshot === 'object' &&
    v.snapshot !== null &&
    typeof v.capturedAt === 'string' &&
    (v.source === 'run' || v.source === 'probe')
  );
}

export async function writeCapacity(
  root: string,
  snapshot: RateLimitSnapshot,
  source: CapacitySource,
): Promise<void> {
  const path = capacityPath(root);
  const record: CapacityRecord = { snapshot, capturedAt: new Date().toISOString(), source };
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(record, null, 2)}\n`, 'utf-8');
  await rename(tmpPath, path);
}

export async function readCapacity(root: string): Promise<CapacityRecord | null> {
  const raw = await readFile(capacityPath(root), 'utf-8').catch(() => null);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCapacityRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
