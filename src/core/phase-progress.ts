import type { PhaseMilestone } from '../types/index';

export const PHASE_MAX_FRACTION = 0.95;
export const PHASE_STALL_MS = 30_000;

const ANCHOR_FLOOR: Record<PhaseMilestone, number> = {
  implement: 0,
  verify: 0.6,
  checkbox: 0.95,
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

export function phaseFraction(anchor: PhaseMilestone | undefined): number {
  const floor = anchor ? ANCHOR_FLOOR[anchor] : 0;
  return Math.min(floor, PHASE_MAX_FRACTION);
}
