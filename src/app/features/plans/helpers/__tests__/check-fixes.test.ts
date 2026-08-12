import type { StatusState } from '@/app/services/status-api';
import type { CheckResult } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { buildCheckFixes } from '../check-fixes';

const pass = (cmd: string): CheckResult => ({
  status: 'pass',
  cmd,
  lastRun: '2026-08-11T00:00:00.000Z',
  output: '',
});

const fail = (cmd: string, output: string): CheckResult => ({
  status: 'fail',
  cmd,
  lastRun: '2026-08-11T00:00:00.000Z',
  output,
});

const baseStatus: StatusState = {
  lint: pass('npx biome lint .'),
  format: pass('npx biome format .'),
  test: pass('npx vitest run --passWithNoTests'),
  consistency: pass('pnpm run consistency'),
};

describe('buildCheckFixes', () => {
  it('returns no fixes when everything passes', () => {
    expect(buildCheckFixes(baseStatus)).toEqual([]);
  });

  it('builds one fix entry for a failing single-command check', () => {
    const fixes = buildCheckFixes({
      ...baseStatus,
      test: fail('npx vitest run --passWithNoTests', 'FAIL src/foo.test.ts'),
    });
    expect(fixes).toEqual([
      {
        done: false,
        text: 'Fix the failing "Tests" check',
        description:
          'Fix the failing "Tests" check in this repo.\n\n' +
          'The command was `npx vitest run --passWithNoTests`.\n\n' +
          'Output from the last run:\n\nFAIL src/foo.test.ts',
      },
    ]);
  });

  it('combines lint and format into one "Quality" entry when both fail', () => {
    const fixes = buildCheckFixes({
      ...baseStatus,
      lint: fail('npx biome lint .', 'lint error'),
      format: fail('npx biome format .', 'format error'),
    });
    expect(fixes).toEqual([
      {
        done: false,
        text: 'Fix the failing "Quality" check',
        description:
          'Fix the failing "Quality" check in this repo.\n\n' +
          'The command was `npx biome lint .`.\n\nOutput from the last run:\n\nlint error\n\n' +
          'The command was `npx biome format .`.\n\nOutput from the last run:\n\nformat error',
      },
    ]);
  });

  it('falls back to a placeholder when output is empty', () => {
    const fixes = buildCheckFixes({
      ...baseStatus,
      consistency: fail('pnpm run consistency', ''),
    });
    expect(fixes[0]?.description).toContain('(no output captured)');
  });

  it('builds one entry per failing check, in Quality/Tests/Consistency order', () => {
    const fixes = buildCheckFixes({
      lint: fail('npx biome lint .', 'lint error'),
      format: pass('npx biome format .'),
      test: fail('npx vitest run --passWithNoTests', 'test error'),
      consistency: fail('pnpm run consistency', 'consistency error'),
    });
    expect(fixes.map((f) => f.text)).toEqual([
      'Fix the failing "Quality" check',
      'Fix the failing "Tests" check',
      'Fix the failing "Consistency" check',
    ]);
  });
});
