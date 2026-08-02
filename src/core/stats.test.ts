import { describe, expect, it } from 'vitest';
import type { EntityEntry, TaskLogEntry } from '../types/index';
import { countEntitiesByStatus, countThreadNotes, isoWeekKey, tasksPerWeek } from './stats';

function entity(overrides: Partial<EntityEntry>): EntityEntry {
  return {
    id: 'IDEA-1',
    title: 'Entity',
    created: '2026-07-01',
    tags: [],
    body: '',
    phases: [],
    ...overrides,
  };
}

describe('countEntitiesByStatus', () => {
  it('groups by status and skips unset ones', () => {
    const entities = [
      entity({ status: 'in-progress' }),
      entity({ status: 'in-progress' }),
      entity({ status: 'done' }),
      entity({ status: undefined }),
    ];
    expect(countEntitiesByStatus(entities)).toEqual({ 'in-progress': 2, done: 1 });
  });
});

describe('countThreadNotes', () => {
  it('counts open questions and all decisions', () => {
    const entities = [
      entity({
        thread: [
          { kind: 'question', text: 'Still open?', state: 'open' },
          { kind: 'question', text: 'Answered', state: 'resolved' },
          { kind: 'decision', text: 'Went with X', state: 'resolved' },
          { kind: 'note', text: 'Just a note' },
        ],
      }),
      entity({
        thread: [{ kind: 'decision', text: 'Went with Y' }],
      }),
    ];
    expect(countThreadNotes(entities)).toEqual({ openQuestions: 1, decisions: 2 });
  });

  it('treats a question with no state as open', () => {
    const entities = [entity({ thread: [{ kind: 'question', text: 'Undecided' }] })];
    expect(countThreadNotes(entities)).toEqual({ openQuestions: 1, decisions: 0 });
  });
});

describe('isoWeekKey', () => {
  it('buckets dates within the same ISO week together', () => {
    expect(isoWeekKey('2026-07-27T10:00:00Z')).toBe(isoWeekKey('2026-07-31T23:00:00Z'));
  });

  it('assigns the year to the ISO week that owns its Thursday', () => {
    // 2026-01-01 is a Thursday, so it belongs to 2026's week 1 despite being year-start.
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
  });
});

describe('tasksPerWeek', () => {
  it('buckets and sorts task runs by week', () => {
    const entries: TaskLogEntry[] = [
      {
        id: '1',
        taskKind: 'phase',
        planTitle: 'A',
        agentId: 'claude-code',
        startedAt: '2026-07-27T10:00:00Z',
        endedAt: '2026-07-27T10:05:00Z',
        outcome: 'done',
      },
      {
        id: '2',
        taskKind: 'phase',
        planTitle: 'B',
        agentId: 'claude-code',
        startedAt: '2026-07-28T10:00:00Z',
        endedAt: '2026-07-28T10:05:00Z',
        outcome: 'done',
      },
      {
        id: '3',
        taskKind: 'phase',
        planTitle: 'C',
        agentId: 'claude-code',
        startedAt: '2026-06-01T10:00:00Z',
        endedAt: '2026-06-01T10:05:00Z',
        outcome: 'error',
      },
    ];
    expect(tasksPerWeek(entries)).toEqual([
      { week: isoWeekKey('2026-06-01T10:00:00Z'), count: 1 },
      { week: isoWeekKey('2026-07-27T10:00:00Z'), count: 2 },
    ]);
  });
});
