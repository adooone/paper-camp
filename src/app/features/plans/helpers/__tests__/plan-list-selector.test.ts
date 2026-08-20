import type { IdeaEntry, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_LIST_FILTERS,
  type WorklistRow,
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

const rowTitle = (row: WorklistRow): string => {
  if (row.type === 'plan') return row.plan.title;
  if (row.type === 'fix') return row.fix.title;
  return row.idea.title;
};

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
  it('renders a plan as a plain row even when it carries an idea: backlink', () => {
    const ideas = [idea({ id: 'IDEA-1', title: 'Group idea' })];
    const plans = [plan({ title: 'Child plan', status: 'in-progress', idea: 'IDEA-1' })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows).toEqual([{ type: 'plan', plan: plans[0] }]);
  });

  it('keeps a plan without a matching idea backlink top-level', () => {
    const plans = [plan({ title: 'Orphan', status: 'in-progress' })];
    const { rows } = selectWorklistRows(plans, []);
    expect(rows).toEqual([{ type: 'plan', plan: plans[0] }]);
  });

  it('produces no row for a kind !== note idea with no plans', () => {
    const ideas = [idea({ id: 'IDEA-2', title: 'Undrafted idea' })];
    const { rows } = selectWorklistRows([], ideas);
    expect(rows).toEqual([]);
  });

  it('drops a plan filtered out by status, regardless of its idea backlink', () => {
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

  it('sorts plan rows normally alongside an unrelated kind !== note idea', () => {
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
    expect(rows.map(rowTitle)).toEqual(['Top plan', 'Group child']);
  });

  it('sorts by order by default, taking a note row order from the idea itself', () => {
    const ideas = [idea({ id: 'IDEA-8', title: 'Note', kind: 'note', order: 1 })];
    const plans = [plan({ title: 'Orphan plan', idea: undefined, order: 3 })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows.map(rowTitle)).toEqual(['Note', 'Orphan plan']);
  });

  it('filters notes by subject too', () => {
    const ideas = [
      idea({ title: 'Matching note', kind: 'note', subject: 'Mobile control desk' }),
      idea({ title: 'Other note', kind: 'note', subject: 'Other subject' }),
    ];
    const { rows } = selectWorklistRows([], ideas, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      subject: 'Mobile control desk',
    });
    expect(rows.map(rowTitle)).toEqual(['Matching note']);
  });

  it("renders a fix entity as its own row, inheriting its parent's subject rather than nesting", () => {
    const plans = [
      plan({
        id: 'IDEA-20',
        title: 'Shipped idea',
        status: 'done',
        subject: 'Run & monitor',
      }),
      plan({
        id: 'IDEA-21',
        title: 'A fix',
        status: 'planned',
        entityKind: 'fix',
        idea: 'IDEA-20',
      }),
    ];
    const { rows } = selectWorklistRows(plans, [], {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['planned', 'done'],
    });
    const fixRow = rows.find((r) => r.type === 'fix');
    expect(fixRow).toEqual({
      type: 'fix',
      fix: { ...plans[1], subject: 'Run & monitor' },
    });
  });

  it('renders a fix as its own row even when its parent idea is still open', () => {
    const ideas = [idea({ id: 'IDEA-22', title: 'Open idea' })];
    const plans = [plan({ id: 'IDEA-23', title: 'A fix', entityKind: 'fix', idea: 'IDEA-22' })];
    const { rows } = selectWorklistRows(plans, ideas);
    expect(rows).toContainEqual({ type: 'fix', fix: plans[0] });
  });
});

describe('groupRowsBySubject', () => {
  it('groups plan and note rows by subject, keeping each row in its group', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend' }) },
      { type: 'note' as const, idea: idea({ title: 'B', subject: 'Frontend' }) },
      { type: 'plan' as const, plan: plan({ title: 'C', subject: 'Backend' }) },
    ];
    const groups = groupRowsBySubject(rows);
    expect(groups.find((g) => g.subject === 'Backend')?.rows).toEqual([rows[0], rows[2]]);
    expect(groups.find((g) => g.subject === 'Frontend')?.rows).toEqual([rows[1]]);
  });

  it('orders named groups by the best run-order rank among their rows', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend', order: 3 }) },
      { type: 'plan' as const, plan: plan({ title: 'B', subject: 'Frontend', order: 1 }) },
      { type: 'plan' as const, plan: plan({ title: 'C', subject: 'Backend', order: 5 }) },
    ];
    expect(groupRowsBySubject(rows).map((g) => g.subject)).toEqual(['Frontend', 'Backend']);
  });

  it('reverses ranked group order when sortDirection is desc', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend', order: 1 }) },
      { type: 'plan' as const, plan: plan({ title: 'B', subject: 'Frontend', order: 2 }) },
    ];
    expect(groupRowsBySubject(rows, 'desc').map((g) => g.subject)).toEqual(['Frontend', 'Backend']);
  });

  it('leads a desc-sorted group by its highest rank, not its lowest', () => {
    const rows = [
      { type: 'plan' as const, plan: plan({ title: 'A', subject: 'Backend', order: 1 }) },
      { type: 'plan' as const, plan: plan({ title: 'B', subject: 'Frontend', order: 3 }) },
      { type: 'plan' as const, plan: plan({ title: 'C', subject: 'Backend', order: 5 }) },
    ];
    expect(groupRowsBySubject(rows, 'desc').map((g) => g.subject)).toEqual(['Backend', 'Frontend']);
  });

  it('orders unranked groups after ranked ones, newest-updated first', () => {
    const rows = [
      {
        type: 'plan' as const,
        plan: plan({ title: 'A', subject: 'Stale', updated: '2026-01-01' }),
      },
      { type: 'plan' as const, plan: plan({ title: 'B', subject: 'Ranked', order: 1 }) },
      {
        type: 'plan' as const,
        plan: plan({ title: 'C', subject: 'Fresh', updated: '2026-02-01' }),
      },
    ];
    expect(groupRowsBySubject(rows).map((g) => g.subject)).toEqual(['Ranked', 'Fresh', 'Stale']);
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
    expect(groupRowsBySubject(rows, 'asc', ['Backend'])).toEqual([
      { subject: 'Backend', rows: [rows[0]] },
      { subject: null, rows: [rows[1]] },
    ]);
  });
});
