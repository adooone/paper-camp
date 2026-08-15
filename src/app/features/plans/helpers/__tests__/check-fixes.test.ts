import type { StatusState } from '@/app/services/status-api';
import type { CheckResult, DeskCheckState, PhaseItem } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { buildCheckFixes, upsertCheckFixes } from '../check-fixes';

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
  consistency: pass('pnpm run consistency'),
};

const baseDeskChecks: DeskCheckState[] = [
  { name: 'lint', ...pass('npx biome lint .') },
  { name: 'test', ...pass('npx vitest run --passWithNoTests') },
];

describe('buildCheckFixes', () => {
  it('returns no fixes when everything passes', () => {
    expect(buildCheckFixes(baseStatus, baseDeskChecks)).toEqual([]);
  });

  it('builds one fix entry for a failing single-command check', () => {
    const deskChecks = [
      { name: 'lint', ...pass('npx biome lint .') },
      { name: 'test', ...fail('npx vitest run --passWithNoTests', 'FAIL src/foo.test.ts') },
    ];
    const fixes = buildCheckFixes(baseStatus, deskChecks);
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

  it('builds one "Quality" entry when the desk "lint" check fails', () => {
    const deskChecks = [
      { name: 'lint', ...fail('npx biome lint .', 'lint error') },
      { name: 'test', ...pass('npx vitest run --passWithNoTests') },
    ];
    const fixes = buildCheckFixes(baseStatus, deskChecks);
    expect(fixes).toEqual([
      {
        done: false,
        text: 'Fix the failing "Quality" check',
        description:
          'Fix the failing "Quality" check in this repo.\n\n' +
          'The command was `npx biome lint .`.\n\nOutput from the last run:\n\nlint error',
      },
    ]);
  });

  it('falls back to a placeholder when output is empty', () => {
    const fixes = buildCheckFixes(
      { consistency: fail('pnpm run consistency', '') },
      baseDeskChecks,
    );
    expect(fixes[0]?.description).toContain('(no output captured)');
  });

  it('builds one entry per failing check, in Quality/Tests/Consistency order', () => {
    const deskChecks = [
      { name: 'lint', ...fail('npx biome lint .', 'lint error') },
      { name: 'test', ...fail('npx vitest run --passWithNoTests', 'test error') },
    ];
    const fixes = buildCheckFixes(
      { consistency: fail('pnpm run consistency', 'consistency error') },
      deskChecks,
    );
    expect(fixes.map((f) => f.text)).toEqual([
      'Fix the failing "Quality" check',
      'Fix the failing "Tests" check',
      'Fix the failing "Consistency" check',
    ]);
  });

  it('skips a group whose desk check is not declared', () => {
    const fixes = buildCheckFixes(baseStatus, [
      { name: 'lint', ...fail('npx biome lint .', 'lint error') },
    ]);
    expect(fixes.map((f) => f.text)).toEqual(['Fix the failing "Quality" check']);
  });
});

describe('upsertCheckFixes', () => {
  it('appends a fix entry for a check with no prior entry', () => {
    const deskChecks = [
      { name: 'lint', ...pass('npx biome lint .') },
      { name: 'test', ...fail('npx vitest run --passWithNoTests', 'FAIL src/foo.test.ts') },
    ];
    expect(upsertCheckFixes([], baseStatus, deskChecks)).toEqual(
      buildCheckFixes(baseStatus, deskChecks),
    );
  });

  it('replaces a repeat failure in place instead of appending a duplicate', () => {
    const existing: PhaseItem[] = [
      {
        done: false,
        text: 'Fix the failing "Tests" check',
        description: 'stale description from a previous run',
      },
    ];
    const deskChecks = [
      { name: 'lint', ...pass('npx biome lint .') },
      { name: 'test', ...fail('npx vitest run --passWithNoTests', 'still failing') },
    ];
    const merged = upsertCheckFixes(existing, baseStatus, deskChecks);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual({
      done: false,
      text: 'Fix the failing "Tests" check',
      description:
        'Fix the failing "Tests" check in this repo.\n\n' +
        'The command was `npx vitest run --passWithNoTests`.\n\n' +
        'Output from the last run:\n\nstill failing',
    });
  });

  it('preserves position: a repeat failure keeps its original index among mixed entries', () => {
    const existing: PhaseItem[] = [
      { done: true, text: 'Some unrelated done phase' },
      { done: false, text: 'Fix the failing "Quality" check', description: 'old' },
      { done: false, text: 'Some other open fix' },
    ];
    const deskChecks = [
      { name: 'lint', ...fail('npx biome lint .', 'lint error') },
      { name: 'test', ...pass('npx vitest run --passWithNoTests') },
    ];
    const merged = upsertCheckFixes(existing, baseStatus, deskChecks);
    expect(merged.map((f) => f.text)).toEqual([
      'Some unrelated done phase',
      'Fix the failing "Quality" check',
      'Some other open fix',
    ]);
    expect(merged[1]?.description).toContain('lint error');
  });

  it('leaves entries for checks that are not currently failing untouched', () => {
    const existing: PhaseItem[] = [
      { done: true, text: 'Fix the failing "Tests" check', description: 'already fixed' },
    ];
    const merged = upsertCheckFixes(existing, baseStatus, baseDeskChecks);
    expect(merged).toEqual(existing);
  });

  it('appends new failures after existing entries, without disturbing prior ones', () => {
    const existing: PhaseItem[] = [{ done: false, text: 'Fix the failing "Tests" check' }];
    const deskChecks = [
      { name: 'lint', ...pass('npx biome lint .') },
      { name: 'test', ...fail('npx vitest run --passWithNoTests', 'test error') },
    ];
    const merged = upsertCheckFixes(
      existing,
      { consistency: fail('pnpm run consistency', 'consistency error') },
      deskChecks,
    );
    expect(merged.map((f) => f.text)).toEqual([
      'Fix the failing "Tests" check',
      'Fix the failing "Consistency" check',
    ]);
  });
});
