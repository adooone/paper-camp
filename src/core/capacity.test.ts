import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RateLimitSnapshot } from '../types/index';
import { readCapacity, writeCapacity } from './capacity';

describe('capacity', () => {
  const dirs: string[] = [];

  beforeEach(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-capacity-test-'));
    dirs.push(dir);
    vi.stubEnv('PAPERCAMP_CONFIG_DIR', dir);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  const configDir = () => dirs[dirs.length - 1];

  const snapshot: RateLimitSnapshot = {
    status: 'allowed',
    unifiedWindows: { five_hour: { utilization: 0.5 } },
  };

  it('returns null when no capacity file has ever been written', async () => {
    expect(await readCapacity()).toBeNull();
  });

  it('round-trips a written snapshot with its source', async () => {
    await writeCapacity(snapshot, 'probe');
    const record = await readCapacity();
    expect(record?.snapshot).toEqual(snapshot);
    expect(record?.source).toBe('probe');
    expect(typeof record?.capturedAt).toBe('string');
  });

  it('overwrites an earlier reading with a later one', async () => {
    await writeCapacity(snapshot, 'run');
    const later: RateLimitSnapshot = { status: 'rejected' };
    await writeCapacity(later, 'probe');
    const record = await readCapacity();
    expect(record?.snapshot).toEqual(later);
    expect(record?.source).toBe('probe');
  });

  it('returns a window whose resetsAt has passed as stored, unfiltered', async () => {
    const expired: RateLimitSnapshot = {
      status: 'rejected',
      unifiedWindows: { five_hour: { utilization: 0.9, resetsAt: 1_700_000_000 } },
    };
    await writeCapacity(expired, 'run');
    const record = await readCapacity();
    expect(record?.snapshot).toEqual(expired);
  });

  it('returns null for a malformed capacity file instead of throwing', async () => {
    await writeFile(join(configDir(), 'capacity.json'), 'not json', 'utf-8');
    expect(await readCapacity()).toBeNull();
  });

  it('writes the file atomically, leaving no stray temp file behind', async () => {
    await writeCapacity(snapshot, 'run');
    const names = await readdir(configDir());
    expect(names).toEqual(['capacity.json']);
    const raw = await readFile(join(configDir(), 'capacity.json'), 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});
