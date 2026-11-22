import { SEVERITY_ORDER, sortedFindings } from '@/core/night-findings';
import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export interface ChunkRow {
  chunk: string;
  findings: NightSuggestionEntry[];
  counts: { severity: NightFindingSeverity; count: number }[];
  checks: string;
}

export const SEVERITY_MEANING: Record<NightFindingSeverity, StampMeaning> = {
  critical: 'failed',
  high: 'parked',
  normal: 'idle',
};

export const NIGHT_EMPTY = {
  title: 'No findings',
  line: 'The review passes have nothing open for this project.',
};

export const severityCounts = (findings: NightSuggestionEntry[]): ChunkRow['counts'] =>
  SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  })).filter(({ count }) => count > 0);

export const chunkRows = (findings: NightSuggestionEntry[]): ChunkRow[] => {
  const byChunk = new Map<string, NightSuggestionEntry[]>();
  for (const finding of sortedFindings(findings)) {
    byChunk.set(finding.chunk, [...(byChunk.get(finding.chunk) ?? []), finding]);
  }
  return [...byChunk].map(([chunk, grouped]) => ({
    chunk,
    findings: grouped,
    counts: severityCounts(grouped),
    checks: [...new Set(grouped.map((finding) => finding.check))].join(', '),
  }));
};

export const reportSummary = (group: NightReportGroup): string =>
  `${group.date} · ${group.passCount} ${group.passCount === 1 ? 'pass' : 'passes'} · $${group.costUsd.toFixed(2)}`;

export const findingLocation = (finding: NightSuggestionEntry): string =>
  finding.line ? `${finding.file}:${finding.line}` : finding.file;
