import type { IdeaEntry, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_LIST_FILTERS,
  deriveChildrenSummary,
  groupRowsBySubject,
  selectPlanRows,
  selectWorklistRows,
} from '../plan-list-selector';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const idea = (overrides: Partial<IdeaEntry>): IdeaEntry => ({
  id: null,
  title: 'Untitled idea',
  body: '',
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
      sortKey: 'status',
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

  it('sorts ordered entries ascending first, then unordered entries by created date, by default', () => {
    const entries = [
      plan({ title: 'unordered-new', status: 'planned', created: '2026-02-01' }),
      plan({ title: 'ordered-2', status: 'planned', order: 2 }),
      plan({ title: 'unordered-old', status: 'planned', created: '2026-01-01' }),
      plan({ title: 'ordered-1', status: 'planned', order: 1 }),
    ];
    const { rows } = selectPlanRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['planned'],
    });
    expect(rows.map((p) => p.title)).toEqual([
      'ordered-1',
      'ordered-2',
      'unordered-old',
      'unordered-new',
    ]);
  });

  it('filters by subject, exact match only', () => {
    const entries = [
      plan({ title: 'Mobile A', status: 'planned', subject: 'Mobile control desk' }),
      plan({ title: 'Mobile B', status: 'planned', subject: 'Mobile control desk' }),
      plan({ title: 'Other', status: 'planned', subject: 'Other subject' }),
      plan({ title: 'No subject', status: 'planned' }),
    ];
    const { rows } = selectPlanRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['planned'],
      subject: 'Mobile control desk',
    });
    expect(rows.map((p) => p.title)).toEqual(['Mobile A', 'Mobile B']);
  });

  it('keeps unordered entries last even when sorting order descending', () => {
    const entries = [
      plan({ title: 'unordered-new', status: 'planned', created: '2026-02-01' }),
      plan({ title: 'ordered-2', status: 'planned', order: 2 }),
      plan({ title: 'unordered-old', status: 'planned', created: '2026-01-01' }),
      plan({ title: 'ordered-1', status: 'planned', order: 1 }),
    ];
    const { rows } = selectPlanRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['planned'],
      sortDirection: 'desc',
    });
    expect(rows.map((p) => p.title)).toEqual([
      'ordered-2',
      'ordered-1',
      'unordered-old',
      'unordered-new',
    ]);
  });
});

describe('deriveChildrenSummary', () => {
  it('returns null before any plan is drafted', () => {
    expect(deriveChildrenSummary([])).toBeNull();
  });

  it('counts done children against the total', () => {
    const children = [
      plan({ title: 'A', status: 'done' }),
      plan({ title: 'B', status: 'done' }),
      plan({ title: 'C', status: 'in-progress' }),
    ];
    expect(deriveChildrenSummary(children)).toEqual({ done: 2, total: 3 });
  });
});

describe('selectWorklistRows', () => {
  it('nests a plan under its idea via the idea: backlink, one level only', () => {
    const ideas = [idea({ id: 'IDEA-1', title: 'Group idea' })];
    const plans = [plan({ title: 'Child plan', status: 'in-progress', idea: 'IDEA-1' })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows).toEqual([{ type: 'idea-group', idea: ideas[0], children: [plans[0]] }]);
  });

  it('keeps a plan without a matching idea backlink top-level', () => {
    const plans = [plan({ title: 'Orphan', status: 'in-progress' })];
    const { rows } = selectWorklistRows(plans, []);
    expect(rows).toEqual([{ type: 'plan', plan: plans[0] }]);
  });

  it('shows a plan-bearing idea with no drafted plans yet as an empty group', () => {
    const ideas = [idea({ id: 'IDEA-2', title: 'Undrafted idea' })];
    const { rows } = selectWorklistRows([], ideas);
    expect(rows).toEqual([{ type: 'idea-group', idea: ideas[0], children: [] }]);
  });

  it('drops a group once every child is filtered out and the idea itself misses search', () => {
    const ideas = [idea({ id: 'IDEA-3', title: 'Done idea' })];
    const plans = [plan({ title: 'Done child', status: 'done', idea: 'IDEA-3' })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows).toEqual([]);
  });

  it('surfaces kind: note ideas as their own rows, gated by noteStatuses', () => {
    const ideas = [
      idea({ id: 'IDEA-4', title: 'Open note', kind: 'note', status: 'open' }),
      idea({ id: 'IDEA-5', title: 'Done note', kind: 'note', status: 'done' }),
    ];
    const { rows, noteStatusCounts } = selectWorklistRows([], ideas);
    expect(rows).toEqual([{ type: 'note', idea: ideas[0] }]);
    expect(noteStatusCounts).toEqual({ open: 1, done: 1, dropped: 0 });
  });

  it('sorts a group by its most-advanced child alongside ordinary plan rows', () => {
    const ideas = [idea({ id: 'IDEA-6', title: 'Grouped idea' })];
    const plans = [
      plan({ title: 'Group child', status: 'planned', idea: 'IDEA-6', updated: '2026-01-01' }),
      plan({ title: 'Top plan', status: 'in-progress', updated: '2026-01-01' }),
    ];
    const { rows } = selectWorklistRows(plans, ideas, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      sortKey: 'status',
      statuses: ['in-progress', 'planned'],
    });
    expect(rows.map((r) => (r.type === 'plan' ? r.plan.title : r.idea.title))).toEqual([
      'Top plan',
      'Grouped idea',
    ]);
  });

  it('sorts by order by default, taking an idea-group or note row order from the idea itself', () => {
    const ideas = [
      idea({ id: 'IDEA-7', title: 'Grouped idea', order: 2 }),
      idea({ id: 'IDEA-8', title: 'Note', kind: 'note', order: 1 }),
    ];
    const plans = [plan({ title: 'Orphan plan', idea: undefined, order: 3 })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows.map((r) => (r.type === 'plan' ? r.plan.title : r.idea.title))).toEqual([
      'Note',
      'Grouped idea',
      'Orphan plan',
    ]);
  });

  it('filters idea-groups and notes by subject too', () => {
    const ideas = [
      idea({ id: 'IDEA-9', title: 'Matching idea', subject: 'Mobile control desk' }),
      idea({ id: 'IDEA-10', title: 'Other idea', subject: 'Other subject' }),
      idea({ title: 'Matching note', kind: 'note', subject: 'Mobile control desk' }),
      idea({ title: 'Other note', kind: 'note', subject: 'Other subject' }),
    ];
    const { rows } = selectWorklistRows([], ideas, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      subject: 'Mobile control desk',
    });
    expect(rows.map((r) => (r.type === 'plan' ? r.plan.title : r.idea.title))).toEqual([
      'Matching idea',
      'Matching note',
    ]);
  });
});

describe('groupRowsBySubject', () => {
  it('groups plan and note rows by subject, in first-seen order', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend' }) },
      { type: 'note' as const, idea: idea({ title: 'B', subject: 'Frontend' }) },
      { type: 'plan' as const, plan: plan({ title: 'C', subject: 'Backend' }) },
    ];
    expect(groupRowsBySubject(rows)).toEqual([
      { subject: 'Backend', rows: [rows[0], rows[2]] },
      { subject: 'Frontend', rows: [rows[1]] },
    ]);
  });

  it('collects subjectless rows into a virtual "No subject" group, ordered last', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'No subject plan' }) },
      { type: 'plan' as const, plan: plan({ title: 'Subject plan', subject: 'Backend' }) },
    ];
    expect(groupRowsBySubject(rows)).toEqual([
      { subject: 'Backend', rows: [rows[1]] },
      { subject: null, rows: [rows[0]] },
    ]);
  });

  it('produces no groups for an empty row list', () => {
    expect(groupRowsBySubject([])).toEqual([]);
  });

  it('demotes a row whose subject is not in validSubjects to "No subject"', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend' }) },
      { type: 'plan' as const, plan: plan({ title: 'B', subject: 'Deleted subject' }) },
    ];
    expect(groupRowsBySubject(rows, ['Backend'])).toEqual([
      { subject: 'Backend', rows: [rows[0]] },
      { subject: null, rows: [rows[1]] },
    ]);
  });
});
