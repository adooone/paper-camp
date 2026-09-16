import { nightFindingKey } from '@/core/night-findings';
import type { NightSuggestionEntry } from '@/types/index';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  NightReportSection,
  groupByChunk,
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

// The chunk grid renders each chunk as a <ChunkCard>, a real component (it owns
// per-chunk hook state for "Fix all"), so — unlike the plain render functions
// elsewhere in this file — its own output isn't inlined into the tree these
// tests inspect without a renderer. Read its chunk/findings props instead.
function chunkCards(tree: ReactElement): { chunk: string; findings: NightSuggestionEntry[] }[] {
  const groupDiv = tree.props.children[0] as ReactElement;
  const grid = groupDiv.props.children[1] as ReactElement;
  const cards = grid.props.children as ReactElement[];
  return cards.map((card) => ({
    chunk: card.props.chunk as string,
    findings: card.props.findings as NightSuggestionEntry[],
  }));
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

describe('groupByChunk', () => {
  it('groups by chunk, preserving first-occurrence order', () => {
    const findings = [
      finding({ chunk: 'src/core', file: 'a.ts' }),
      finding({ chunk: 'src/app', file: 'b.ts' }),
      finding({ chunk: 'src/core', file: 'c.ts' }),
    ];
    expect(groupByChunk(findings).map((g) => [g.chunk, g.findings.length])).toEqual([
      ['src/core', 2],
      ['src/app', 1],
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
    const tree = NightReportSection({ groups: [], onOpenChunk: () => {} });
    expect(tree).toBeNull();
  });

  it('shows the date, pass/cost summary and severity counts, with one card per chunk', () => {
    const findings = [
      finding({ chunk: 'src/core', file: 'a.ts', severity: 'critical' }),
      finding({ chunk: 'src/core', file: 'b.ts', severity: 'high' }),
      finding({ chunk: 'src/app', file: 'c.ts', severity: 'normal' }),
    ];
    const tree = NightReportSection({
      groups: [{ date: '2026-09-10', passCount: 3, costUsd: 0.45, findings }],
      onOpenChunk: () => {},
    }) as ReactElement;
    const text = textOf(tree);
    expect(text).toContain('Review findings — 2026-09-10');
    expect(text).toContain('3 passes');
    expect(text).toContain('$0.45');
    expect(text).toContain('1 critical');
    expect(text).toContain('1 high');
    expect(text).toContain('1 normal');

    const cards = chunkCards(tree);
    expect(cards.map((c) => c.chunk)).toEqual(['src/core', 'src/app']);
    expect(cards.find((c) => c.chunk === 'src/core')?.findings).toHaveLength(2);
    expect(cards.find((c) => c.chunk === 'src/app')?.findings).toHaveLength(1);
  });

  it('renders a card per chunk at any finding count, with no collapse threshold', () => {
    const findings = Array.from({ length: 11 }, (_, i) =>
      finding({ file: `f${i}.ts`, chunk: i < 6 ? 'src/core' : 'src/app' }),
    );
    const tree = NightReportSection({
      groups: [{ date: '2026-09-10', passCount: 1, costUsd: 0, findings }],
      onOpenChunk: () => {},
    }) as ReactElement;
    const cards = chunkCards(tree);
    expect(cards.find((c) => c.chunk === 'src/core')?.findings).toHaveLength(6);
    expect(cards.find((c) => c.chunk === 'src/app')?.findings).toHaveLength(5);
  });

  it('reports a clean night when a date has passes but no findings', () => {
    const tree = NightReportSection({
      groups: [{ date: '2026-09-10', passCount: 2, costUsd: 0.1, findings: [] }],
      onOpenChunk: () => {},
    });
    expect(textOf(tree)).toContain('Ran clean — no findings.');
  });
});
