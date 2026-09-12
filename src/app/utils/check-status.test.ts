import type { CheckResult, DeskCheckState } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { failingCheckNames } from './check-status';

const deskCheck = (name: string, status: CheckResult['status']): DeskCheckState => ({
  name,
  cmd: '',
  status,
  lastRun: null,
  output: '',
});

describe('failingCheckNames', () => {
  it('returns no names when nothing is failing', () => {
    expect(failingCheckNames([deskCheck('lint', 'pass'), deskCheck('test', 'pass')])).toEqual([]);
  });

  it('names every failing check, in manifest order', () => {
    expect(
      failingCheckNames([
        deskCheck('types', 'fail'),
        deskCheck('lint', 'pass'),
        deskCheck('Consistency', 'fail'),
      ]),
    ).toEqual(['types', 'Consistency']);
  });

  it('does not count a running or stale check as failing', () => {
    expect(failingCheckNames([deskCheck('lint', 'running'), deskCheck('test', 'stale')])).toEqual(
      [],
    );
  });
});
