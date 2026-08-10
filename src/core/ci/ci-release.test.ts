import { describe, expect, it } from 'vitest';
import { latestRunPerWorkflow, mapRunStatus, parseVersion, pickReleasePr } from './ci-release';

describe('mapRunStatus', () => {
  it('maps completed conclusions', () => {
    expect(mapRunStatus('completed', 'success')).toBe('success');
    expect(mapRunStatus('completed', 'failure')).toBe('failure');
    expect(mapRunStatus('completed', 'timed_out')).toBe('failure');
    expect(mapRunStatus('completed', 'cancelled')).toBe('cancelled');
    expect(mapRunStatus('completed', 'skipped')).toBe('unknown');
  });

  it('maps in-flight statuses', () => {
    expect(mapRunStatus('queued', '')).toBe('queued');
    expect(mapRunStatus('waiting', '')).toBe('queued');
    expect(mapRunStatus('in_progress', '')).toBe('in_progress');
  });
});

describe('parseVersion', () => {
  it('extracts a semver from a release-please title', () => {
    expect(parseVersion('chore(main): release 0.18.0')).toBe('0.18.0');
    expect(parseVersion('chore(main): release 1.2.3-rc.1')).toBe('1.2.3-rc.1');
    expect(parseVersion('v0.17.1')).toBe('0.17.1');
  });

  it('returns null when there is no version', () => {
    expect(parseVersion('chore: tidy up')).toBeNull();
  });
});

describe('latestRunPerWorkflow', () => {
  it('keeps the first (latest) run per workflow on the tracked branch', () => {
    const rows = [
      {
        workflowName: 'CI',
        status: 'completed',
        conclusion: 'success',
        url: 'u1',
        headBranch: 'main',
      },
      {
        workflowName: 'CI',
        status: 'completed',
        conclusion: 'failure',
        url: 'u2',
        headBranch: 'main',
      },
      {
        workflowName: 'Release',
        status: 'in_progress',
        conclusion: '',
        url: 'u3',
        headBranch: 'main',
      },
      {
        workflowName: 'CI',
        status: 'completed',
        conclusion: 'success',
        url: 'u4',
        headBranch: 'dev',
      },
    ];
    expect(latestRunPerWorkflow(rows, 'main')).toEqual([
      { workflow: 'CI', status: 'success', url: 'u1' },
      { workflow: 'Release', status: 'in_progress', url: 'u3' },
    ]);
  });
});

describe('pickReleasePr', () => {
  it('finds the release-please PR by branch prefix', () => {
    const rows = [
      { number: 5, title: 'feat: thing', url: 'a', headRefName: 'feat/x', labels: [] },
      {
        number: 9,
        title: 'chore(main): release 0.18.0',
        url: 'b',
        headRefName: 'release-please--branches--main',
        labels: [],
      },
    ];
    expect(pickReleasePr(rows)).toEqual({
      number: 9,
      title: 'chore(main): release 0.18.0',
      url: 'b',
      version: '0.18.0',
    });
  });

  it('finds it by autorelease label', () => {
    const rows = [
      {
        number: 3,
        title: 'Release 2.0.0',
        url: 'c',
        headRefName: 'some-branch',
        labels: [{ name: 'autorelease: pending' }],
      },
    ];
    expect(pickReleasePr(rows)?.version).toBe('2.0.0');
  });

  it('returns null when no release PR is open', () => {
    expect(pickReleasePr([])).toBeNull();
  });
});
