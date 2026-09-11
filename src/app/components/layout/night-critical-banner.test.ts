import type { NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { criticalNightFindings, formatCriticalSummary } from './night-critical-banner';

function finding(overrides: Partial<NightSuggestionEntry> = {}): NightSuggestionEntry {
  return {
    date: '2026-09-10',
    check: 'security',
    chunk: 'src/core',
    file: 'src/core/a.ts',
    line: 12,
    commit: 'abc1234',
    severity: 'critical',
    message: 'Unvalidated input reaches a shell command.',
    ...overrides,
  };
}

function group(overrides: Partial<NightReportGroup> = {}): NightReportGroup {
  return { date: '2026-09-10', passCount: 1, costUsd: 0.1, findings: [], ...overrides };
}

describe('criticalNightFindings', () => {
  it('flattens groups and keeps only critical findings', () => {
    const groups = [
      group({
        findings: [finding({ severity: 'critical' }), finding({ severity: 'high', file: 'b.ts' })],
      }),
      group({ date: '2026-09-09', findings: [finding({ severity: 'critical', file: 'c.ts' })] }),
    ];
    expect(criticalNightFindings(groups).map((f) => f.file)).toEqual(['src/core/a.ts', 'c.ts']);
  });

  it('is empty when there are no critical findings', () => {
    const groups = [group({ findings: [finding({ severity: 'normal' })] })];
    expect(criticalNightFindings(groups)).toEqual([]);
  });
});

describe('formatCriticalSummary', () => {
  it('names the single finding with its location and message', () => {
    const summary = formatCriticalSummary([finding()]);
    expect(summary).toBe('src/core/a.ts:12 — Unvalidated input reaches a shell command.');
  });

  it('omits the line when the finding has none', () => {
    const summary = formatCriticalSummary([finding({ line: null })]);
    expect(summary).toBe('src/core/a.ts — Unvalidated input reaches a shell command.');
  });

  it('summarizes multiple findings by count and file list', () => {
    const summary = formatCriticalSummary([finding({ file: 'a.ts' }), finding({ file: 'b.ts' })]);
    expect(summary).toBe('2 critical findings: a.ts, b.ts');
  });
});
