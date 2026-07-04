import { describe, expect, it } from 'vitest';
import type { IdeaEntry, PlanEntry } from '../types/index';
import { deriveIdeaStatuses } from './idea-status';

const idea = (overrides: Partial<IdeaEntry>): IdeaEntry => ({
  id: 'IDEA-1',
  title: 'An idea',
  body: '',
  ...overrides,
});

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'A plan',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  phases: [],
  body: '',
  ...overrides,
});

describe('deriveIdeaStatuses', () => {
  it('marks an idea with no linked plans as planned', () => {
    const [result] = deriveIdeaStatuses([idea({})], []);
    expect(result.status).toBe('planned');
  });

  it('marks an idea done once every linked plan is done or dropped', () => {
    const plans = [
      plan({ idea: 'IDEA-1', status: 'done' }),
      plan({ idea: 'IDEA-1', status: 'dropped' }),
    ];
    const [result] = deriveIdeaStatuses([idea({})], plans);
    expect(result.status).toBe('done');
  });

  it('keeps an idea planned while any linked plan is open', () => {
    const plans = [
      plan({ idea: 'IDEA-1', status: 'done' }),
      plan({ idea: 'IDEA-1', status: 'in-progress' }),
    ];
    const [result] = deriveIdeaStatuses([idea({})], plans);
    expect(result.status).toBe('planned');
  });

  it('honors an explicit frontmatter status: done even with no linked plans', () => {
    const [result] = deriveIdeaStatuses([idea({ status: 'done' })], []);
    expect(result.status).toBe('done');
  });

  it('honors an explicit done over open linked plans', () => {
    const plans = [plan({ idea: 'IDEA-1', status: 'in-progress' })];
    const [result] = deriveIdeaStatuses([idea({ status: 'done' })], plans);
    expect(result.status).toBe('done');
  });
});
