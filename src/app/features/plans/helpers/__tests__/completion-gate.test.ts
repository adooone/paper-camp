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
  it('is ready when every phase and fix is checked, a PR exists, and CI is green', () => {
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

  it('names a missing PR when there is none to merge', () => {
    expect(completionGate(plan({ pr: undefined }), true).missing).toContain('an open PR');
  });

  it('does not require an approving review — completing is the approval', () => {
    const result = completionGate(
      plan({ pr: approvedPr({ reviewDecision: 'review-required' }) }),
      true,
    );
    expect(result.missing).not.toContain('an open PR');
    expect(result.ready).toBe(true);
  });

  it('blocks on a review that requested changes', () => {
    const result = completionGate(
      plan({ pr: approvedPr({ reviewDecision: 'changes-requested' }) }),
      true,
    );
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('requested changes');
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
    expect(result.missing).toEqual(['open phases', 'open fixes', 'an open PR', 'CI']);
  });
});
