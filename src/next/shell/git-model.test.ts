import { describe, expect, it } from 'vitest';
import {
  commitEyebrow,
  describeDivergence,
  describeEntryStatus,
  describeSync,
  hygieneStamp,
  syncStamp,
} from './git-model';

const sync = (ahead: number, behind: number, diverged = false) => ({ ahead, behind, diverged });

describe('hygiene', () => {
  it('stamps the known states and falls back to a neutral word', () => {
    expect(hygieneStamp('fine')).toEqual({ label: 'clean', meaning: 'done' });
    expect(hygieneStamp('dirty')).toEqual({ label: 'dirty', meaning: 'parked' });
    expect(hygieneStamp('stale-merged')).toEqual({ label: 'stale', meaning: 'failed' });
    expect(hygieneStamp('stale-no-upstream')).toEqual({
      label: 'stale no upstream',
      meaning: 'idle',
    });
  });
});

describe('sync', () => {
  it('describes the branch against its remote', () => {
    expect(describeSync(sync(0, 0))).toBe('Up to date with the remote');
    expect(describeSync(sync(2, 0))).toBe('2 to push');
    expect(describeSync(sync(1, 22))).toBe('1 to push · 22 to pull');
  });

  it('stamps synced, ahead or behind, and diverged', () => {
    expect(syncStamp(sync(0, 0))).toEqual({ label: 'synced', meaning: 'done' });
    expect(syncStamp(sync(1, 22))).toEqual({ label: '↑1 ↓22', meaning: 'parked' });
    expect(syncStamp(sync(0, 3))).toEqual({ label: '↓3', meaning: 'parked' });
    expect(syncStamp(sync(1, 22, true))).toEqual({ label: 'diverged', meaning: 'failed' });
  });

  it('explains why there is no push while diverged', () => {
    expect(describeDivergence(sync(1, 2, true), 0)).toContain('replays your commit on top');
    expect(describeDivergence(sync(3, 2, true), 0)).toContain('your 3 commits');
    expect(describeDivergence(sync(1, 2, true), 4)).toContain('commit the changes first');
  });
});

describe('describeEntryStatus', () => {
  const entry = (status: string, staged = false) => ({ path: 'a.ts', status, staged });

  it('words a porcelain code', () => {
    expect(describeEntryStatus(entry('??'))).toEqual({ label: 'new', meaning: 'parked' });
    expect(describeEntryStatus(entry('UU'))).toEqual({ label: 'conflict', meaning: 'failed' });
    expect(describeEntryStatus(entry('A '))).toEqual({ label: 'added', meaning: 'done' });
    expect(describeEntryStatus(entry(' D'))).toEqual({ label: 'deleted', meaning: 'failed' });
    expect(describeEntryStatus(entry('R '))).toEqual({ label: 'renamed', meaning: 'running' });
    expect(describeEntryStatus(entry(' M'))).toEqual({ label: 'modified', meaning: 'running' });
    expect(describeEntryStatus(entry('M ', true))).toEqual({ label: 'staged', meaning: 'done' });
  });
});

describe('commitEyebrow', () => {
  it('joins what a commit has', () => {
    expect(commitEyebrow(['feat', null, '2h ago'])).toBe('feat · 2h ago');
    expect(commitEyebrow(['', 'IDEA-3', ''])).toBe('IDEA-3');
  });
});
