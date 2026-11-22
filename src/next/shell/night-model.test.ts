import { describe, expect, it } from 'vitest';
import type { NightSuggestionEntry } from '@/types/index';
import { chunkRows, findingLocation, reportSummary, severityCounts } from './night-model';

const finding = (overrides: Partial<NightSuggestionEntry> = {}): NightSuggestionEntry => ({
  date: '2026-09-10',
  check: 'bugs',
  chunk: 'src/core',
  file: 'src/core/a.ts',
  line: 12,
  commit: 'abc1234',
  severity: 'high',
  message: 'Off-by-one in the turn counter.',
  ...overrides,
});

describe('night model', () => {
  it('counts the severities present, most severe first', () => {
    expect(
      severityCounts([
        finding({ severity: 'high' }),
        finding({ severity: 'critical', file: 'b.ts' }),
        finding({ severity: 'high', file: 'c.ts' }),
      ]),
    ).toEqual([
      { severity: 'critical', count: 1 },
      { severity: 'high', count: 2 },
    ]);
  });

  it('groups findings by chunk, keeping the most severe finding first in each', () => {
    const rows = chunkRows([
      finding({ chunk: 'src/app', file: 'z.ts', severity: 'normal', check: 'tests' }),
      finding({ chunk: 'src/core', file: 'b.ts', severity: 'normal' }),
      finding({ chunk: 'src/core', file: 'a.ts', severity: 'critical', check: 'security' }),
    ]);
    expect(rows.map((row) => row.chunk)).toEqual(['src/core', 'src/app']);
    expect(rows[0].findings.map((entry) => entry.file)).toEqual(['a.ts', 'b.ts']);
    expect(rows[0].checks).toBe('security, bugs');
    expect(rows[0].counts).toEqual([
      { severity: 'critical', count: 1 },
      { severity: 'normal', count: 1 },
    ]);
  });

  it('summarises a report and locates a finding', () => {
    expect(reportSummary({ date: '2026-09-10', passCount: 1, costUsd: 0.5, findings: [] })).toBe(
      '2026-09-10 · 1 pass · $0.50',
    );
    expect(reportSummary({ date: '2026-09-10', passCount: 3, costUsd: 1.234, findings: [] })).toBe(
      '2026-09-10 · 3 passes · $1.23',
    );
    expect(findingLocation(finding())).toBe('src/core/a.ts:12');
    expect(findingLocation(finding({ line: null }))).toBe('src/core/a.ts');
  });
});
