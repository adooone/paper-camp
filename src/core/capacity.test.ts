import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { RateLimitSnapshot } from '../types/index';
import { readCapacity, writeCapacity } from './capacity';

describe('capacity', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
    dirs.length = 0;
  });

  async function makeRoot(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-capacity-test-'));
    dirs.push(dir);
    return dir;
  }

  const snapshot: RateLimitSnapshot = {
    status: 'allowed',
    unifiedWindows: { five_hour: { utilization: 0.5 } },
  };

  it('returns null when no capacity file has ever been written', async () => {
    const root = await makeRoot();
    expect(await readCapacity(root)).toBeNull();
  });

  it('round-trips a written snapshot with its source', async () => {
    const root = await makeRoot();
    await writeCapacity(root, snapshot, 'probe');
    const record = await readCapacity(root);
    expect(record?.snapshot).toEqual(snapshot);
    expect(record?.source).toBe('probe');
    expect(typeof record?.capturedAt).toBe('string');
  });

  it('overwrites an earlier reading with a later one', async () => {
    const root = await makeRoot();
    await writeCapacity(root, snapshot, 'run');
    const later: RateLimitSnapshot = { status: 'rejected' };
    await writeCapacity(root, later, 'probe');
    const record = await readCapacity(root);
    expect(record?.snapshot).toEqual(later);
    expect(record?.source).toBe('probe');
  });

  it('returns a window whose resetsAt has passed as stored, unfiltered', async () => {
    const root = await makeRoot();
    const expired: RateLimitSnapshot = {
      status: 'rejected',
      unifiedWindows: { five_hour: { utilization: 0.9, resetsAt: 1_700_000_000 } },
    };
    await writeCapacity(root, expired, 'run');
    const record = await readCapacity(root);
    expect(record?.snapshot).toEqual(expired);
  });

  it('returns null for a malformed capacity file instead of throwing', async () => {
    const root = await makeRoot();
    await mkdir(join(root, 'papercamp'), { recursive: true });
    await writeFile(join(root, 'papercamp', 'capacity.json'), 'not json', 'utf-8');
    expect(await readCapacity(root)).toBeNull();
  });

  it('writes the file atomically, leaving no stray temp file behind', async () => {
    const root = await makeRoot();
    await writeCapacity(root, snapshot, 'run');
    const names = await readdir(join(root, 'papercamp'));
    expect(names).toEqual(['capacity.json']);
    const raw = await readFile(join(root, 'papercamp', 'capacity.json'), 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});
