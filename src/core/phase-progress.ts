import type { PhaseMilestone, TaskLogEntry } from '../types/index';

export const PHASE_MAX_FRACTION = 0.95;
export const PHASE_STALL_MS = 30_000;

const SEGMENT_SPAN: Record<PhaseMilestone, { from: number; to: number }> = {
  implement: { from: 0, to: 0.6 },
  verify: { from: 0.6, to: 0.9 },
  checkbox: { from: 0.95, to: 0.95 },
};

const ANCHOR_RANK: Record<PhaseMilestone, number> = {
  implement: 0,
  verify: 1,
  checkbox: 2,
};

export function classifyAnchor(
  tool: string,
  input: Record<string, unknown> | undefined,
): PhaseMilestone | null {
  const name = tool.toLowerCase();
  if (name === 'bash') {
    const command = typeof input?.command === 'string' ? input.command : '';
    return command.includes('check-types') ? 'verify' : null;
  }
  if (name === 'edit' || name === 'multiedit' || name === 'write') {
    const before = typeof input?.old_string === 'string' ? input.old_string : '';
    const after = typeof input?.new_string === 'string' ? input.new_string : '';
    if (before.includes('- [ ]') && after.includes('- [x]')) return 'checkbox';
    return 'implement';
  }
  return null;
}

export function advanceAnchor(
  current: PhaseMilestone | undefined,
  next: PhaseMilestone,
): PhaseMilestone {
  if (!current) return next;
  return ANCHOR_RANK[next] > ANCHOR_RANK[current] ? next : current;
}

export function isPhaseStalled(lastStreamAt: number | undefined, now: number): boolean {
  if (lastStreamAt === undefined) return false;
  return now - lastStreamAt >= PHASE_STALL_MS;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function medianSegmentMs(entries: TaskLogEntry[]): Partial<Record<PhaseMilestone, number>> {
  const durations = entries
    .filter((entry) => entry.taskKind === 'phase' && entry.outcome === 'done')
    .map((entry) => Date.parse(entry.endedAt) - Date.parse(entry.startedAt))
    .filter((ms) => Number.isFinite(ms) && ms > 0);
  if (durations.length === 0) return {};
  const phaseMs = median(durations);
  const segments: Partial<Record<PhaseMilestone, number>> = {};
  for (const anchor of ['implement', 'verify'] as const) {
    const width = SEGMENT_SPAN[anchor].to - SEGMENT_SPAN[anchor].from;
    segments[anchor] = (phaseMs * width) / PHASE_MAX_FRACTION;
  }
  return segments;
}

export interface PhaseFractionInput {
  anchor: PhaseMilestone | undefined;
  anchorEnteredAt: number | undefined;
  lastStreamAt: number | undefined;
  now: number;
  medians?: Partial<Record<PhaseMilestone, number>>;
}

export function phaseFraction({
  anchor,
  anchorEnteredAt,
  lastStreamAt,
  now,
  medians,
}: PhaseFractionInput): number {
  if (!anchor) return 0;
  const span = SEGMENT_SPAN[anchor];
  const floor = Math.min(span.from, PHASE_MAX_FRACTION);
  const segmentMs = medians?.[anchor];
  if (!segmentMs || segmentMs <= 0 || anchorEnteredAt === undefined || span.to === span.from) {
    return floor;
  }
  const clock = lastStreamAt === undefined ? now : Math.min(now, lastStreamAt + PHASE_STALL_MS);
  const ratio = Math.min(1, Math.max(0, clock - anchorEnteredAt) / segmentMs);
  return Math.min(span.from + ratio * (span.to - span.from), PHASE_MAX_FRACTION);
}
