import type { WorklistEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PLAN_LIST_FILTERS,
  type WorklistRow,
  deriveChildrenSummary,
  groupRowsBySubject,
  selectPlanRows,
  selectWorklistRows,
} from '../plan-list-selector';

let nextId = 1;

const plan = (overrides: Partial<WorklistEntry>): WorklistEntry => ({
  id: `IDEA-${nextId++}`,
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  needs: [],
  phasesDone: 0,
  phasesTotal: 0,
  active: false,
  ...overrides,
});

const note = (overrides: Partial<WorklistEntry>): WorklistEntry =>
  plan({ kind: 'note', status: 'open', title: 'Untitled note', ...overrides });

const rowTitle = (row: WorklistRow): string => row.entry.title;

const asRow = (entry: WorklistEntry, type: WorklistRow['type'] = 'plan'): WorklistRow => ({
  type,
  entry,
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

  it('filters by search across title and id', () => {
    const entries = [
      plan({ title: 'Filter plans', status: 'planned' }),
      plan({ title: 'Other', status: 'planned' }),
    ];
    const { rows } = selectPlanRows(entries, { ...DEFAULT_PLAN_LIST_FILTERS, search: 'filter' });
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
  it('renders a plan as a plain row even when it carries a parent backlink', () => {
    const entries = [plan({ title: 'Child plan', status: 'in-progress', parent: 'IDEA-1' })];
    const { rows } = selectWorklistRows(entries);
    expect(rows).toEqual([{ type: 'plan', entry: entries[0] }]);
  });

  it('drops a plan filtered out by status', () => {
    const { rows } = selectWorklistRows([plan({ title: 'Done child', status: 'done' })]);
    expect(rows).toEqual([]);
  });

  it('surfaces notes as their own rows, gated by noteStatuses', () => {
    const entries = [
      note({ title: 'Open note', status: 'open' }),
      note({ title: 'Done note', status: 'done' }),
    ];
    const { rows, noteStatusCounts } = selectWorklistRows(entries);
    expect(rows).toEqual([{ type: 'note', entry: entries[0] }]);
    expect(noteStatusCounts).toEqual({ open: 1, done: 1, dropped: 0 });
  });

  it('sorts plan rows normally alongside notes', () => {
    const entries = [
      plan({ title: 'Group child', status: 'planned', updated: '2026-01-01' }),
      plan({ title: 'Top plan', status: 'in-progress', updated: '2026-01-01' }),
    ];
    const { rows } = selectWorklistRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      sortKey: 'status',
      statuses: ['in-progress', 'planned'],
    });
    expect(rows.map(rowTitle)).toEqual(['Top plan', 'Group child']);
  });

  it('sorts by order by default, taking a note row order from the note itself', () => {
    const entries = [note({ title: 'Note', order: 1 }), plan({ title: 'Orphan plan', order: 3 })];
    const { rows } = selectWorklistRows(entries);
    expect(rows.map(rowTitle)).toEqual(['Note', 'Orphan plan']);
  });

  it('filters notes by subject too', () => {
    const entries = [
      note({ title: 'Matching note', subject: 'Mobile control desk' }),
      note({ title: 'Other note', subject: 'Other subject' }),
    ];
    const { rows } = selectWorklistRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      subject: 'Mobile control desk',
    });
    expect(rows.map(rowTitle)).toEqual(['Matching note']);
  });

  it("renders a fix as its own row, inheriting its parent's subject rather than nesting", () => {
    const entries = [
      plan({ id: 'IDEA-20', title: 'Shipped idea', status: 'done', subject: 'Run & monitor' }),
      plan({ id: 'IDEA-21', title: 'A fix', kind: 'fix', parent: 'IDEA-20' }),
    ];
    const { rows } = selectWorklistRows(entries, {
      ...DEFAULT_PLAN_LIST_FILTERS,
      statuses: ['planned', 'done'],
    });
    expect(rows.find((r) => r.type === 'fix')).toEqual({
      type: 'fix',
      entry: { ...entries[1], subject: 'Run & monitor' },
    });
  });

  it('never renders a ticket as a row — only its board owns that list', () => {
    const entries = [
      plan({ id: 'IDEA-24', title: 'A board', kind: 'board' }),
      plan({ id: 'TICKET-1', title: 'A ticket', kind: 'ticket', parent: 'IDEA-24' }),
    ];
    const { rows } = selectWorklistRows(entries);
    expect(rows.map(rowTitle)).toEqual(['A board']);
  });
});

describe('groupRowsBySubject', () => {
  it('groups plan and note rows by subject, keeping each row in its group', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Backend' })),
      asRow(note({ title: 'B', subject: 'Frontend' }), 'note'),
      asRow(plan({ title: 'C', subject: 'Backend' })),
    ];
    const groups = groupRowsBySubject(rows);
    expect(groups.find((g) => g.subject === 'Backend')?.rows).toEqual([rows[0], rows[2]]);
    expect(groups.find((g) => g.subject === 'Frontend')?.rows).toEqual([rows[1]]);
  });

  it('orders named groups by the best run-order rank among their rows', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Backend', order: 3 })),
      asRow(plan({ title: 'B', subject: 'Frontend', order: 1 })),
      asRow(plan({ title: 'C', subject: 'Backend', order: 5 })),
    ];
    expect(groupRowsBySubject(rows).map((g) => g.subject)).toEqual(['Frontend', 'Backend']);
  });

  it('reverses ranked group order when sortDirection is desc', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Backend', order: 1 })),
      asRow(plan({ title: 'B', subject: 'Frontend', order: 2 })),
    ];
    expect(groupRowsBySubject(rows, 'desc').map((g) => g.subject)).toEqual(['Frontend', 'Backend']);
  });

  it('leads a desc-sorted group by its highest rank, not its lowest', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Backend', order: 1 })),
      asRow(plan({ title: 'B', subject: 'Frontend', order: 3 })),
      asRow(plan({ title: 'C', subject: 'Backend', order: 5 })),
    ];
    expect(groupRowsBySubject(rows, 'desc').map((g) => g.subject)).toEqual(['Backend', 'Frontend']);
  });

  it('orders unranked groups after ranked ones, newest-updated first', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Stale', updated: '2026-01-01' })),
      asRow(plan({ title: 'B', subject: 'Ranked', order: 1 })),
      asRow(plan({ title: 'C', subject: 'Fresh', updated: '2026-02-01' })),
    ];
    expect(groupRowsBySubject(rows).map((g) => g.subject)).toEqual(['Ranked', 'Fresh', 'Stale']);
  });

  it('collects subjectless rows into a virtual "No subject" group, ordered last', () => {
    const rows = [
      asRow(plan({ title: 'No subject plan' })),
      asRow(plan({ title: 'Subject plan', subject: 'Backend' })),
    ];
    expect(groupRowsBySubject(rows)).toEqual([
      { subject: 'Backend', rows: [rows[1]] },
      { subject: null, rows: [rows[0]] },
    ]);
  });

  it('produces no groups for an empty row list', () => {
    expect(groupRowsBySubject([])).toEqual([]);
  });

  it('demotes a row whose subject is not in its own project vocabulary', () => {
    const rows = [
      asRow(plan({ title: 'A', subject: 'Backend' })),
      asRow(plan({ title: 'B', subject: 'Deleted subject' })),
    ];
    expect(groupRowsBySubject(rows, 'asc', new Map([['', new Set(['Backend'])]]))).toEqual([
      { subject: 'Backend', rows: [rows[0]] },
      { subject: null, rows: [rows[1]] },
    ]);
  });

  it('checks each row against its own project, and keeps subjects of a project without a vocabulary', () => {
    const project = { runtimeUrl: 'http://other' } as WorklistRow['project'];
    const own = asRow(plan({ title: 'Own', subject: 'Backend' }));
    const foreign: WorklistRow = {
      ...asRow(plan({ title: 'Foreign', subject: 'Elsewhere' })),
      project,
    };
    const unknown: WorklistRow = {
      ...asRow(plan({ title: 'Unknown', subject: 'Elsewhere' })),
      project: { runtimeUrl: 'http://unknown' } as WorklistRow['project'],
    };
    const groups = groupRowsBySubject(
      [own, foreign, unknown],
      'asc',
      new Map([
        ['', new Set(['Backend'])],
        ['http://other', new Set(['Other'])],
      ]),
    );
    expect(groups).toEqual([
      { subject: 'Backend', rows: [own] },
      { subject: 'Elsewhere', rows: [unknown] },
      { subject: null, rows: [foreign] },
    ]);
  });
});
