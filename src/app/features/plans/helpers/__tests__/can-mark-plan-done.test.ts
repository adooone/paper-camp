import type { PhaseItem, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { canMarkPlanDone } from '../helpers';

const phase = (done: boolean): PhaseItem => ({ done, text: 'phase' });

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [phase(true)],
  ...overrides,
});

describe('canMarkPlanDone', () => {
  it('is true for a no-PR plan with every phase and fix checked', () => {
    expect(canMarkPlanDone(plan({ phases: [phase(true)] }))).toBe(true);
    expect(canMarkPlanDone(plan({ phases: [phase(true)], fixes: [phase(true)] }))).toBe(true);
  });

  it('is false when a phase or fix is unchecked', () => {
    expect(canMarkPlanDone(plan({ phases: [phase(true), phase(false)] }))).toBe(false);
    expect(
      canMarkPlanDone(plan({ phases: [phase(true)], fixes: [phase(true), phase(false)] })),
    ).toBe(false);
  });

  it('is false when there are no phases at all', () => {
    expect(canMarkPlanDone(plan({ phases: [] }))).toBe(false);
  });

  it('is false once a PR exists, even with every phase checked', () => {
    expect(
      canMarkPlanDone(plan({ phases: [phase(true)], pr: { number: 1, url: 'u', state: 'open' } })),
    ).toBe(false);
  });

  it('is false for done, dropped, and review — each already has its own control', () => {
    expect(canMarkPlanDone(plan({ phases: [phase(true)], status: 'done' }))).toBe(false);
    expect(canMarkPlanDone(plan({ phases: [phase(true)], status: 'dropped' }))).toBe(false);
    expect(canMarkPlanDone(plan({ phases: [phase(true)], status: 'review' }))).toBe(false);
  });
});
