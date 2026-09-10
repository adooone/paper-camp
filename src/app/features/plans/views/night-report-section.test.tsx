import type { NightSuggestionEntry } from '@/types/index';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  NightReportSection,
  nightFindingKey,
  severityCounts,
  sortedFindings,
} from './night-report-section';

function finding(overrides: Partial<NightSuggestionEntry> = {}): NightSuggestionEntry {
  return {
    date: '2026-09-10',
    check: 'bugs',
    chunk: 'src/core',
    file: 'src/core/a.ts',
    line: 12,
    commit: 'abc1234',
    severity: 'high',
    message: 'Off-by-one in the turn counter.',
    ...overrides,
  };
}

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const element = node as ReactElement;
  if (!element.props) return '';
  return textOf(element.props.children as ReactNode);
}

describe('severityCounts', () => {
  it('counts each severity present, in critical/high/normal order, skipping zero counts', () => {
    const findings = [
      finding({ severity: 'high' }),
      finding({ severity: 'critical', file: 'b.ts' }),
      finding({ severity: 'high', file: 'c.ts' }),
    ];
    expect(severityCounts(findings)).toEqual([
      { severity: 'critical', count: 1 },
      { severity: 'high', count: 2 },
    ]);
  });

  it('is empty for no findings', () => {
    expect(severityCounts([])).toEqual([]);
  });
});

describe('sortedFindings', () => {
  it('orders critical before high before normal, then by file', () => {
    const findings = [
      finding({ severity: 'normal', file: 'z.ts' }),
      finding({ severity: 'critical', file: 'b.ts' }),
      finding({ severity: 'critical', file: 'a.ts' }),
      finding({ severity: 'high', file: 'm.ts' }),
    ];
    expect(sortedFindings(findings).map((f) => `${f.severity}:${f.file}`)).toEqual([
      'critical:a.ts',
      'critical:b.ts',
      'high:m.ts',
      'normal:z.ts',
    ]);
  });
});

describe('nightFindingKey', () => {
  it('combines date, check, file, and line into a stable key', () => {
    expect(nightFindingKey(finding())).toBe('2026-09-10-bugs-src/core/a.ts-12');
  });

  it('uses "null" for a finding with no line', () => {
    expect(nightFindingKey(finding({ line: null }))).toBe('2026-09-10-bugs-src/core/a.ts-null');
  });
});

describe('NightReportSection', () => {
  it('renders nothing for an empty group list', () => {
    const tree = NightReportSection({ groups: [], onOpen: () => {}, onDismiss: () => {} });
    expect(tree).toBeNull();
  });

  it('shows the date, pass/cost summary, severity counts, and each finding', () => {
    const tree = NightReportSection({
      groups: [
        {
          date: '2026-09-10',
          passCount: 3,
          costUsd: 0.45,
          findings: [
            finding({ severity: 'critical', file: 'b.ts' }),
            finding({ severity: 'high' }),
          ],
        },
      ],
      onOpen: () => {},
      onDismiss: () => {},
    });
    const text = textOf(tree);
    expect(text).toContain('Night report — 2026-09-10');
    expect(text).toContain('3 passes');
    expect(text).toContain('$0.45');
    expect(text).toContain('1 critical');
    expect(text).toContain('1 high');
    expect(text).toContain('night');
    expect(text).toContain('Off-by-one in the turn counter.');
  });

  it('reports a clean night when a date has passes but no findings', () => {
    const tree = NightReportSection({
      groups: [{ date: '2026-09-10', passCount: 2, costUsd: 0.1, findings: [] }],
      onOpen: () => {},
      onDismiss: () => {},
    });
    expect(textOf(tree)).toContain('Ran clean — no findings.');
  });
});
