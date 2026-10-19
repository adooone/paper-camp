import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mockSpawn }));

import {
  ciRunWord,
  failedJobNames,
  fetchCiReleaseState,
  hasSecret,
  latestDraftPrRun,
  latestRunPerWorkflow,
  mapRunStatus,
  parseVersion,
  pickReleasePr,
} from './ci-release';

function fakeProc(code: number, stdout: string) {
  const proc = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: () => void;
  };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn();
  queueMicrotask(() => {
    if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
    proc.emit('close', code);
  });
  return proc;
}

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

describe('failedJobNames', () => {
  it('lists only the jobs that failed', () => {
    expect(
      failedJobNames([
        { name: 'Quality', conclusion: 'success' },
        { name: 'Smoke', conclusion: 'failure' },
        { name: 'Tests', conclusion: 'cancelled' },
      ]),
    ).toEqual(['Smoke']);
  });
});

describe('latestDraftPrRun', () => {
  it('takes the first row regardless of branch', () => {
    const rows = [
      {
        workflowName: 'Draft PR',
        status: 'completed',
        conclusion: 'success',
        url: 'u1',
        headBranch: 'feat/idea-1-thing',
      },
    ];
    expect(latestDraftPrRun(rows)).toEqual({ workflow: 'Draft PR', status: 'success', url: 'u1' });
  });

  it('returns null when there are no runs', () => {
    expect(latestDraftPrRun([])).toBeNull();
  });
});

describe('hasSecret', () => {
  it('finds a secret by name', () => {
    expect(hasSecret([{ name: 'SCOUT_APP_ID' }, { name: 'OTHER' }], 'SCOUT_APP_ID')).toBe(true);
  });

  it('returns false when the secret is absent', () => {
    expect(hasSecret([{ name: 'OTHER' }], 'SCOUT_PRIVATE_KEY')).toBe(false);
  });
});

describe('ciRunWord', () => {
  it('maps each run status to its word', () => {
    expect(ciRunWord('success')).toBe('passed');
    expect(ciRunWord('failure')).toBe('failed');
    expect(ciRunWord('in_progress')).toBe('running');
    expect(ciRunWord('queued')).toBe('queued');
    expect(ciRunWord('cancelled')).toBe('cancelled');
    expect(ciRunWord('unknown')).toBe('unknown');
  });
});

describe('fetchCiReleaseState', () => {
  it('stamps fetchedAt and sets runs to null when the run list call fails', async () => {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'run') return fakeProc(1, '');
      if (args[0] === 'pr') return fakeProc(0, '[]');
      if (args[0] === 'release') return fakeProc(0, '[]');
      return fakeProc(1, '');
    });
    const state = await fetchCiReleaseState('r', { repo: 'o/r', releasePlease: true }, 0);
    expect(state.available).toBe(true);
    expect(state.runs).toBeNull();
    expect(new Date(state.fetchedAt).toString()).not.toBe('Invalid Date');
  });

  it('marks secretsChecked false when the secrets call fails', async () => {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'run') return fakeProc(0, '[]');
      if (args[0] === 'pr') return fakeProc(0, '[]');
      if (args[0] === 'release') return fakeProc(0, '[]');
      if (args[0] === 'api') return fakeProc(1, '');
      return fakeProc(1, '');
    });
    const state = await fetchCiReleaseState('r', { repo: 'o/r', draftPr: true }, 0);
    expect(state.draftPr).toEqual({
      scoutAppId: false,
      scoutPrivateKey: false,
      secretsChecked: false,
      lastRun: null,
    });
  });

  it('marks secretsChecked true and reads presence when the secrets call succeeds', async () => {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === 'run') return fakeProc(0, '[]');
      if (args[0] === 'pr') return fakeProc(0, '[]');
      if (args[0] === 'release') return fakeProc(0, '[]');
      if (args[0] === 'api') {
        return fakeProc(0, JSON.stringify({ secrets: [{ name: 'SCOUT_APP_ID' }] }));
      }
      return fakeProc(1, '');
    });
    const state = await fetchCiReleaseState('r', { repo: 'o/r', draftPr: true }, 0);
    expect(state.draftPr).toEqual({
      scoutAppId: true,
      scoutPrivateKey: false,
      secretsChecked: true,
      lastRun: null,
    });
  });
});
