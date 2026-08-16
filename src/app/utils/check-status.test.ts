import type { StatusState } from '@/app/services/status-api';
import type { CheckResult, DeskCheckState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { deriveCheckStatuses } from './check-status';

const result = (status: CheckResult['status']): CheckResult => ({
  status,
  cmd: '',
  lastRun: null,
  output: '',
});

const status = (overrides: Partial<StatusState>): StatusState => ({
  consistency: result('pass'),
  prFetchedAt: null,
  ...overrides,
});

const deskCheck = (name: string, status: CheckResult['status']): DeskCheckState => ({
  name,
  cmd: '',
  status,
  lastRun: null,
  output: '',
});

const deskChecks = (overrides: Partial<Record<'lint' | 'test', CheckResult['status']>>) =>
  [
    deskCheck('lint', overrides.lint ?? 'pass'),
    deskCheck('test', overrides.test ?? 'pass'),
  ] as DeskCheckState[];

describe('deriveCheckStatuses', () => {
  it('reports pass across the board when nothing is failing', () => {
    expect(deriveCheckStatuses(status({}), deskChecks({}))).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('reports quality failing when the desk "lint" check fails', () => {
    expect(deriveCheckStatuses(status({}), deskChecks({ lint: 'fail' })).qualityStatus).toBe(
      'fail',
    );
  });

  it('reverts quality to pass once the desk "lint" check passes again', () => {
    expect(deriveCheckStatuses(status({}), deskChecks({ lint: 'fail' })).qualityStatus).toBe(
      'fail',
    );
    expect(deriveCheckStatuses(status({}), deskChecks({ lint: 'pass' })).qualityStatus).toBe(
      'pass',
    );
  });

  it('reverts tests and consistency to pass once their checks re-report clean', () => {
    const failing = status({ consistency: result('fail') });
    expect(deriveCheckStatuses(failing, deskChecks({ test: 'fail' }))).toMatchObject({
      testStatus: 'fail',
      consistencyStatus: 'fail',
    });

    const fixed = status({ consistency: result('pass') });
    expect(deriveCheckStatuses(fixed, deskChecks({ test: 'pass' }))).toMatchObject({
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('treats a running desk check as running', () => {
    expect(deriveCheckStatuses(status({}), deskChecks({ lint: 'running' })).qualityStatus).toBe(
      'running',
    );
  });

  it('falls back to stale fields when status or desk checks are missing', () => {
    expect(deriveCheckStatuses(null, [])).toEqual({
      qualityStatus: 'stale',
      testStatus: 'stale',
      consistencyStatus: 'stale',
    });
    expect(deriveCheckStatuses(undefined, [])).toEqual({
      qualityStatus: 'stale',
      testStatus: 'stale',
      consistencyStatus: 'stale',
    });
  });

  it('does not fold build into the commit-gate statuses', () => {
    expect(
      deriveCheckStatuses(status({}), [...deskChecks({}), deskCheck('build', 'fail')]),
    ).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });
});
