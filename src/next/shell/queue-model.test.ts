import { describe, expect, it } from 'vitest';
import type { BatchPreviewItem } from '@/app/services/batch-api';
import {
  formatCost,
  itemDetail,
  moveTarget,
  needsSync,
  pruneToReady,
  queueTotals,
  readinessStamp,
  readyIds,
  totalsLine,
  unplannedIds,
} from './queue-model';

const item = (id: string, overrides: Partial<BatchPreviewItem> = {}): BatchPreviewItem => ({
  id,
  title: `Idea ${id}`,
  readiness: { ready: true },
  phaseCount: 2,
  costEstimateUsd: 1.5,
  ...overrides,
});

const blocked = (id: string): BatchPreviewItem =>
  item(id, {
    readiness: { ready: false, reason: 'needs', message: 'waits for IDEA-1' },
    costEstimateUsd: null,
  });

describe('queue model', () => {
  it('formats a cost estimate, with a floor for fractions of a cent', () => {
    expect(formatCost(null)).toBe('—');
    expect(formatCost(0.004)).toBe('$<0.01');
    expect(formatCost(0)).toBe('$0.00');
    expect(formatCost(2.456)).toBe('$2.46');
  });

  it('picks the ready ideas in run order', () => {
    expect(readyIds([item('A'), blocked('B'), item('C')])).toEqual(['A', 'C']);
  });

  it('totals the phases and cost of the picked ideas only', () => {
    const order = [item('A'), blocked('B'), item('C', { phaseCount: 1, costEstimateUsd: 0.5 })];
    const totals = queueTotals(order, new Set(['A', 'C']));
    expect(totals).toEqual({ count: 2, phases: 3, costUsd: 2 });
    expect(totalsLine(totals)).toBe('2 ideas · 3 phases · ~$2.00');
    expect(totalsLine({ count: 1, phases: 1, costUsd: 0 })).toBe('1 idea · 1 phase · ~$0.00');
  });

  it('turns a move into the one-based slot, and nothing past either end', () => {
    expect(moveTarget(1, -1, 3)).toBe(1);
    expect(moveTarget(1, 1, 3)).toBe(3);
    expect(moveTarget(0, -1, 3)).toBeNull();
    expect(moveTarget(2, 1, 3)).toBeNull();
  });

  it('describes an item and stamps its readiness', () => {
    expect(itemDetail(item('A'))).toBe('2 phases · $1.50');
    expect(itemDetail(item('A', { phaseCount: 1, costEstimateUsd: null }))).toBe('1 phase · —');
    expect(readinessStamp(item('A'))).toEqual({ label: 'ready', meaning: 'done' });
    expect(readinessStamp(blocked('B'))).toEqual({ label: 'waits for IDEA-1', meaning: 'parked' });
  });

  it('drops picks that stopped being ready', () => {
    const order = [item('A'), blocked('B')];
    expect([...pruneToReady(new Set(['A', 'B', 'Z']), order)]).toEqual(['A']);
  });

  it('syncs only when behind or diverged', () => {
    expect(needsSync('behind')).toBe(true);
    expect(needsSync('diverged')).toBe(true);
    expect(needsSync('clean')).toBe(false);
    expect(needsSync('dirty')).toBe(false);
  });

  it('lists the backlog ideas that still need a plan', () => {
    expect(
      unplannedIds([
        { id: 'A', title: 'a', hasPhases: false },
        { id: 'B', title: 'b', hasPhases: true },
      ]),
    ).toEqual(['A']);
  });
});
