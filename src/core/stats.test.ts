import { describe, expect, it } from 'vitest';
import type { EntityEntry, RunUsage, TaskLogEntry } from '../types/index';
import {
  countEntitiesByStatus,
  countThreadNotes,
  isoWeekKey,
  medianPhaseDurationMs,
  mostExpensiveIdeas,
  tasksPerWeek,
  usagePerWeek,
} from './stats';

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

function usage(overrides: Partial<RunUsage> = {}): RunUsage {
  return {
    durationMs: 0,
    numTurns: 1,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    ...overrides,
  };
}

function logEntry(overrides: Partial<TaskLogEntry>): TaskLogEntry {
  return {
    id: 'x',
    taskKind: 'phase',
    planTitle: 'Plan',
    agentId: 'claude-code',
    startedAt: '2026-07-27T10:00:00Z',
    endedAt: '2026-07-27T10:05:00Z',
    outcome: 'done',
    ...overrides,
  };
}

describe('usagePerWeek', () => {
  it('sums retroactive wall-clock minutes and post-landing tokens per week', () => {
    const entries: TaskLogEntry[] = [
      logEntry({
        startedAt: '2026-07-27T10:00:00Z',
        endedAt: '2026-07-27T10:10:00Z',
        usage: usage({ inputTokens: 1000, outputTokens: 100 }),
      }),
      logEntry({
        startedAt: '2026-07-28T10:00:00Z',
        endedAt: '2026-07-28T10:20:00Z',
        taskKind: 'run-all',
        phaseRuns: [
          { kind: 'phase', index: 0, usage: usage({ inputTokens: 2000, outputTokens: 200 }) },
          { kind: 'fix', index: 0, usage: usage({ inputTokens: 500, outputTokens: 50 }) },
        ],
      }),
      logEntry({ startedAt: '2026-06-01T10:00:00Z', endedAt: '2026-06-01T10:05:00Z' }),
    ];
    expect(usagePerWeek(entries)).toEqual([
      { week: isoWeekKey('2026-06-01'), agentMinutes: 5, inputTokens: 0, outputTokens: 0 },
      { week: isoWeekKey('2026-07-27'), agentMinutes: 30, inputTokens: 3500, outputTokens: 350 },
    ]);
  });
});

describe('medianPhaseDurationMs', () => {
  it('takes the median over phase-kind runs, ignoring fixes and non-phase tasks', () => {
    const entries: TaskLogEntry[] = [
      logEntry({
        taskKind: 'run-all',
        phaseRuns: [
          { kind: 'phase', index: 0, usage: usage({ durationMs: 100 }) },
          { kind: 'phase', index: 1, usage: usage({ durationMs: 300 }) },
          { kind: 'fix', index: 0, usage: usage({ durationMs: 9999 }) },
        ],
      }),
      logEntry({ taskKind: 'phase', usage: usage({ durationMs: 200 }) }),
      logEntry({ taskKind: 'draft', usage: usage({ durationMs: 9999 }) }),
    ];
    expect(medianPhaseDurationMs(entries)).toBe(200);
  });

  it('returns null when no phase runs are recorded', () => {
    expect(medianPhaseDurationMs([logEntry({ taskKind: 'draft' })])).toBeNull();
  });
});

describe('mostExpensiveIdeas', () => {
  it('groups by plan id, ranks by total tokens, and skips runs without usage', () => {
    const entries: TaskLogEntry[] = [
      logEntry({ planId: 'IDEA-1', usage: usage({ inputTokens: 100, outputTokens: 10 }) }),
      logEntry({ planId: 'IDEA-1', usage: usage({ inputTokens: 200, outputTokens: 20 }) }),
      logEntry({ planId: 'IDEA-2', usage: usage({ inputTokens: 5000, outputTokens: 500 }) }),
      logEntry({ planId: 'IDEA-3', taskKind: 'feedback' }),
      logEntry({ planId: undefined, usage: usage({ inputTokens: 9, outputTokens: 9 }) }),
    ];
    const result = mostExpensiveIdeas(entries);
    expect(result.map((i) => i.planId)).toEqual(['IDEA-2', 'IDEA-1']);
    expect(result[1]).toMatchObject({ inputTokens: 300, outputTokens: 30 });
  });

  it('caps the list at the requested limit', () => {
    const entries: TaskLogEntry[] = [1, 2, 3].map((n) =>
      logEntry({ planId: `IDEA-${n}`, usage: usage({ inputTokens: n * 100, outputTokens: n }) }),
    );
    expect(mostExpensiveIdeas(entries, 2)).toHaveLength(2);
  });
});
