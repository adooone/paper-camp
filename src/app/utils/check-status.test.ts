import type { CheckResult, DeskCheckState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { deriveCheckStatuses } from './check-status';

const deskCheck = (name: string, status: CheckResult['status']): DeskCheckState => ({
  name,
  cmd: '',
  status,
  lastRun: null,
  output: '',
});

const deskChecks = (
  overrides: Partial<Record<'lint' | 'test' | 'Consistency', CheckResult['status']>>,
) =>
  [
    deskCheck('lint', overrides.lint ?? 'pass'),
    deskCheck('test', overrides.test ?? 'pass'),
    deskCheck('Consistency', overrides.Consistency ?? 'pass'),
  ] as DeskCheckState[];

describe('deriveCheckStatuses', () => {
  it('reports pass across the board when nothing is failing', () => {
    expect(deriveCheckStatuses(deskChecks({}))).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('reports quality failing when the desk "lint" check fails', () => {
    expect(deriveCheckStatuses(deskChecks({ lint: 'fail' })).qualityStatus).toBe('fail');
  });

  it('reverts quality to pass once the desk "lint" check passes again', () => {
    expect(deriveCheckStatuses(deskChecks({ lint: 'fail' })).qualityStatus).toBe('fail');
    expect(deriveCheckStatuses(deskChecks({ lint: 'pass' })).qualityStatus).toBe('pass');
  });

  it('reverts tests and consistency to pass once their checks re-report clean', () => {
    expect(deriveCheckStatuses(deskChecks({ test: 'fail', Consistency: 'fail' }))).toMatchObject({
      testStatus: 'fail',
      consistencyStatus: 'fail',
    });

    expect(deriveCheckStatuses(deskChecks({ test: 'pass', Consistency: 'pass' }))).toMatchObject({
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('treats a running desk check as running', () => {
    expect(deriveCheckStatuses(deskChecks({ lint: 'running' })).qualityStatus).toBe('running');
  });

  it('falls back to stale fields when desk checks are missing', () => {
    expect(deriveCheckStatuses([])).toEqual({
      qualityStatus: 'stale',
      testStatus: 'stale',
      consistencyStatus: 'stale',
    });
  });

  it('does not fold build into the commit-gate statuses', () => {
    expect(deriveCheckStatuses([...deskChecks({}), deskCheck('build', 'fail')])).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });
});
