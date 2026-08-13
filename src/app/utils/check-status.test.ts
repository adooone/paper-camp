import type { StatusState } from '@/app/services/status-api';
import type { CheckResult } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { deriveBuildStatus, deriveCheckStatuses } from './check-status';

const result = (status: CheckResult['status']): CheckResult => ({
  status,
  cmd: '',
  lastRun: null,
  output: '',
});

const status = (overrides: Partial<StatusState>): StatusState => ({
  lint: result('pass'),
  format: result('pass'),
  test: result('pass'),
  consistency: result('pass'),
  ...overrides,
});

describe('deriveCheckStatuses', () => {
  it('reports pass across the board when nothing is failing', () => {
    expect(deriveCheckStatuses(status({}))).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('reports quality failing when either lint or format fails', () => {
    expect(
      deriveCheckStatuses(status({ lint: result('fail'), format: result('pass') })).qualityStatus,
    ).toBe('fail');
    expect(
      deriveCheckStatuses(status({ lint: result('pass'), format: result('fail') })).qualityStatus,
    ).toBe('fail');
  });

  it('reverts quality to pass once both lint and format pass again', () => {
    const stillFailing = status({ lint: result('fail'), format: result('pass') });
    expect(deriveCheckStatuses(stillFailing).qualityStatus).toBe('fail');

    const fixed = status({ lint: result('pass'), format: result('pass') });
    expect(deriveCheckStatuses(fixed).qualityStatus).toBe('pass');
  });

  it('reverts tests and consistency to pass once their checks re-report clean', () => {
    const failing = status({ test: result('fail'), consistency: result('fail') });
    expect(deriveCheckStatuses(failing)).toMatchObject({
      testStatus: 'fail',
      consistencyStatus: 'fail',
    });

    const fixed = status({ test: result('pass'), consistency: result('pass') });
    expect(deriveCheckStatuses(fixed)).toMatchObject({
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });

  it('treats a running sub-check as running even if another already failed', () => {
    expect(
      deriveCheckStatuses(status({ lint: result('fail'), format: result('running') }))
        .qualityStatus,
    ).toBe('running');
  });

  it('falls back to stale fields when status is null or missing checks', () => {
    expect(deriveCheckStatuses(null)).toEqual({
      qualityStatus: 'stale',
      testStatus: 'stale',
      consistencyStatus: 'stale',
    });
    expect(deriveCheckStatuses(undefined)).toEqual({
      qualityStatus: 'stale',
      testStatus: 'stale',
      consistencyStatus: 'stale',
    });
  });

  it('does not fold build into the commit-gate statuses', () => {
    expect(
      deriveCheckStatuses(
        status({ build: { status: 'fail', cmd: '', lastRun: null, output: '' } }),
      ),
    ).toEqual({
      qualityStatus: 'pass',
      testStatus: 'pass',
      consistencyStatus: 'pass',
    });
  });
});

describe('deriveBuildStatus', () => {
  it('reports the build check status and last-built time', () => {
    expect(
      deriveBuildStatus(
        status({
          build: { status: 'pass', cmd: 'pnpm build', lastRun: '2026-08-13T00:00:00Z', output: '' },
        }),
      ),
    ).toEqual({ buildStatus: 'pass', lastBuilt: '2026-08-13T00:00:00Z' });
  });

  it('falls back to stale/null when status is null or build is missing', () => {
    expect(deriveBuildStatus(null)).toEqual({ buildStatus: 'stale', lastBuilt: null });
    expect(deriveBuildStatus(status({}))).toEqual({ buildStatus: 'stale', lastBuilt: null });
  });
});
