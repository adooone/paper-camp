import type { PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAN_LIST_FILTERS, selectPlanRows } from './plan-list-selector';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

describe('selectPlanRows', () => {
  it('excludes done/dropped by default', () => {
    const entries = [
      plan({ title: 'A', status: 'in-progress' }),
      plan({ title: 'B', status: 'done' }),
      plan({ title: 'C', status: 'dropped' }),
    ];
    const { rows } = selectPlanRows(entries);
    expect(rows.map((p) => p.title)).toEqual(['A']);
  });

  it('sorts by status precedence, then most-recently-updated', () => {
    const entries = [
      plan({ title: 'planned-old', status: 'planned', updated: '2026-01-01' }),
      plan({ title: 'in-progress', status: 'in-progress', updated: '2026-01-02' }),
      plan({ title: 'review', status: 'review', updated: '2026-01-02' }),
      plan({ title: 'planned-new', status: 'planned', updated: '2026-01-05' }),
      plan({ title: 'idea', status: 'idea', updated: '2026-01-02' }),
    ];
    const { rows } = selectPlanRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['in-progress', 'review', 'planned', 'idea'],
    });
    expect(rows.map((p) => p.title)).toEqual([
      'in-progress',
      'review',
      'planned-new',
      'planned-old',
      'idea',
    ]);
  });

  it('filters by search across title and body', () => {
    const entries = [
      plan({ title: 'Filter plans', status: 'planned', body: 'add chips' }),
      plan({ title: 'Other', status: 'planned', body: 'unrelated' }),
    ];
    const { rows } = selectPlanRows(entries, { ...DEFAULT_PLAN_LIST_FILTERS, search: 'chips' });
    expect(rows.map((p) => p.title)).toEqual(['Filter plans']);
  });

  it('filters by tag', () => {
    const entries = [
      plan({ title: 'Tagged', status: 'planned', tags: ['ui'] }),
      plan({ title: 'Untagged', status: 'planned', tags: [] }),
    ];
    const { rows } = selectPlanRows(entries, { ...DEFAULT_PLAN_LIST_FILTERS, tags: ['ui'] });
    expect(rows.map((p) => p.title)).toEqual(['Tagged']);
  });

  it('counts statuses ignoring the status filter itself', () => {
    const entries = [
      plan({ title: 'A', status: 'in-progress' }),
      plan({ title: 'B', status: 'done' }),
      plan({ title: 'C', status: 'done' }),
    ];
    const { statusCounts } = selectPlanRows(entries);
    expect(statusCounts['in-progress']).toBe(1);
    expect(statusCounts.done).toBe(2);
  });

  it('counts tags ignoring the tag filter itself, but respecting status filters', () => {
    const entries = [
      plan({ title: 'A', status: 'in-progress', tags: ['ui'] }),
      plan({ title: 'B', status: 'done', tags: ['ui'] }),
    ];
    const { tagCounts } = selectPlanRows(entries);
    expect(tagCounts.ui).toBe(1);
  });
});
