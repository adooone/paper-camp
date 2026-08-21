import type { PhaseItem, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { hasCompletedPhase } from '../helpers';

const phase = (done: boolean): PhaseItem => ({ done, text: 'phase' });

const plan = (phases: PhaseItem[]): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases,
});

describe('hasCompletedPhase', () => {
  it('is true once at least one phase is checked', () => {
    expect(hasCompletedPhase(plan([phase(false), phase(true)]))).toBe(true);
  });

  it('is false when every phase is unchecked', () => {
    expect(hasCompletedPhase(plan([phase(false), phase(false)]))).toBe(false);
  });

  it('is false when there are no phases at all', () => {
    expect(hasCompletedPhase(plan([]))).toBe(false);
  });
});
