import type { PhaseItem, PlanEntry, PrInfo } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { completionGate } from '../helpers';

const phase = (done: boolean): PhaseItem => ({ done, text: 'phase' });

const approvedPr = (overrides: Partial<PrInfo> = {}): PrInfo => ({
  number: 1,
  url: 'u',
  state: 'open',
  reviewDecision: 'approved',
  ...overrides,
});

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'review',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [phase(true)],
  pr: approvedPr(),
  ...overrides,
});

describe('completionGate', () => {
  it('is ready when every phase and fix is checked, the PR is approved, and CI is green', () => {
    expect(completionGate(plan({ phases: [phase(true)], fixes: [phase(true)] }), true)).toEqual({
      ready: true,
      missing: [],
    });
  });

  it('names open phases', () => {
    expect(completionGate(plan({ phases: [phase(true), phase(false)] }), true).missing).toContain(
      'open phases',
    );
  });

  it('names open fixes', () => {
    expect(completionGate(plan({ fixes: [phase(true), phase(false)] }), true).missing).toContain(
      'open fixes',
    );
  });

  it('names missing PR approval', () => {
    const result = completionGate(
      plan({ pr: approvedPr({ reviewDecision: 'review-required' }) }),
      true,
    );
    expect(result.missing).toContain('PR approval');
  });

  it('names missing PR approval when there is no PR at all', () => {
    expect(completionGate(plan({ pr: undefined }), true).missing).toContain('PR approval');
  });

  it('names missing CI when CI is not green', () => {
    expect(completionGate(plan({}), false).missing).toContain('CI');
    expect(completionGate(plan({}), null).missing).toContain('CI');
    expect(completionGate(plan({}), undefined).missing).toContain('CI');
  });

  it('names every missing condition at once instead of hiding the rest', () => {
    const result = completionGate(
      plan({ phases: [phase(false)], fixes: [phase(false)], pr: undefined }),
      false,
    );
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(['open phases', 'open fixes', 'PR approval', 'CI']);
  });
});
