import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { WorklistEntry } from '@/types/index';
import { IdeaColumn } from '../views/idea-column';
import { ideaGroups, isFoldable, progressOf, statusOf, tabCounts } from './ideas-model';

const entry = (
  id: string,
  status: WorklistEntry['status'],
  done = 0,
  total = 0,
): WorklistEntry => ({
  id,
  title: `Title of ${id}`,
  status,
  tags: [],
  created: '2026-11-01',
  needs: [],
  phasesDone: done,
  phasesTotal: total,
  active: false,
});

const entries = [
  entry('IDEA-1', 'in-progress', 1, 3),
  entry('IDEA-2', 'idea'),
  entry('IDEA-3', 'review', 2, 2),
  entry('IDEA-4', 'done', 1, 1),
  entry('IDEA-5', 'dropped'),
  entry('IDEA-6', 'planned', 0, 4),
];

describe('ideaGroups', () => {
  it('orders the To Do groups in progress, planned, then ideas', () => {
    const groups = ideaGroups(entries, 'todo');
    expect(groups.map((group) => group.status)).toEqual(['in-progress', 'planned', 'idea']);
    expect(groups[0].entries.map((item) => item.id)).toEqual(['IDEA-1']);
  });

  it('puts review alone in its segment and done before dropped', () => {
    expect(ideaGroups(entries, 'review').map((group) => group.status)).toEqual(['review']);
    expect(ideaGroups(entries, 'done').map((group) => group.status)).toEqual(['done', 'dropped']);
  });

  it('skips groups with nothing in them', () => {
    expect(ideaGroups([entry('IDEA-9', 'idea')], 'todo').map((group) => group.status)).toEqual([
      'idea',
    ]);
    expect(ideaGroups([], 'review')).toEqual([]);
  });
});

describe('tabCounts', () => {
  it('counts every entry under the segment that lists its status', () => {
    expect(tabCounts(entries)).toEqual({ todo: 3, review: 1, done: 2 });
  });
});

describe('row copy', () => {
  it('words progress as n / m phases and omits it without phases', () => {
    expect(progressOf(entries[0])).toBe('1 / 3 phases');
    expect(progressOf(entries[1])).toBeNull();
  });

  it('treats a note-only open status as an idea and folds only dropped', () => {
    expect(statusOf(entry('IDEA-7', 'open'))).toBe('idea');
    expect(isFoldable('dropped')).toBe(true);
    expect(isFoldable('done')).toBe(false);
  });
});

describe('IdeaColumn', () => {
  it('invites a pick when nothing is selected', () => {
    expect(renderToStaticMarkup(<IdeaColumn ideaId={undefined} />)).toContain('Pick an idea');
  });
});
