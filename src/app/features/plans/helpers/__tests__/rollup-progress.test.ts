import type { PhaseItem, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { rollupProgress } from '../helpers';

const phase = (done: boolean): PhaseItem => ({ done, text: 'phase' });

const plan = (phases: PhaseItem[], fixes?: PhaseItem[]): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases,
  ...(fixes ? { fixes } : {}),
});

describe('rollupProgress', () => {
  it('is null when there is nothing to track', () => {
    expect(rollupProgress(plan([]), 0)).toBeNull();
  });

  it('matches the whole-phase count when nothing is running', () => {
    expect(rollupProgress(plan([phase(true), phase(false), phase(false)]), 0)).toEqual({
      done: 1,
      total: 3,
      pct: (1 / 3) * 100,
    });
  });

  it('adds the running phase fraction on top of the done count', () => {
    const result = rollupProgress(plan([phase(true), phase(false), phase(false)]), 0.6);
    expect(result?.pct).toBeCloseTo((1.6 / 3) * 100, 5);
  });

  it('counts fixes in the total', () => {
    const result = rollupProgress(plan([phase(true)], [phase(false)]), 0.5);
    expect(result).toEqual({ done: 1, total: 2, pct: (1.5 / 2) * 100 });
  });

  it('never fills past the total', () => {
    const result = rollupProgress(plan([phase(true), phase(false)]), 1.5);
    expect(result).toEqual({ done: 1, total: 2, pct: 100 });
  });
});
