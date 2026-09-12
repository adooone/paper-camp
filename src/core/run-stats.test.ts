import { describe, expect, it } from 'vitest';
import type { LogRow } from '../types/index';
import { computeLogStats } from './run-stats';

const taskRow = (overrides: Partial<LogRow> = {}): LogRow => ({
  id: 'task:task-1',
  timestamp: '2026-08-01T00:00:00.000Z',
  type: 'phase',
  entityId: 'IDEA-1',
  entityTitle: 'First idea',
  title: 'First idea',
  agentId: 'claude-code',
  outcome: 'done',
  source: {
    kind: 'task',
    entry: {
      id: 'task-1',
      taskKind: 'phase',
      planId: 'IDEA-1',
      planTitle: 'First idea',
      agentId: 'claude-code',
      startedAt: '2026-08-01T00:00:00.000Z',
      endedAt: '2026-08-01T00:00:00.000Z',
      outcome: 'done',
    },
  },
  ...overrides,
});

const issueRow = (overrides: Partial<LogRow> = {}): LogRow => ({
  id: 'issue:check:lint',
  timestamp: '2026-08-01T00:00:00.000Z',
  type: 'check',
  title: 'lint failing',
  outcome: 'open',
  source: {
    kind: 'issue',
    issue: {
      id: 'check:lint',
      sourceKind: 'check',
      sourceKey: 'lint',
      title: 'lint failing',
      reason: 'reason',
      thread: [],
      status: 'open',
    },
  },
  ...overrides,
});

describe('computeLogStats', () => {
  it('reads zero for everything on an empty set', () => {
    expect(computeLogStats([])).toEqual({
      runs: 0,
      failed: 0,
      successRate: undefined,
      totalCostUsd: 0,
      medianDurationMs: undefined,
    });
  });

  it('excludes a failure with no run behind it from the run count', () => {
    const stats = computeLogStats([taskRow(), issueRow()]);
    expect(stats.runs).toBe(1);
  });

  it('excludes a reply or a parked question from the run count', () => {
    const reply: LogRow = {
      id: 'notification:notif-1',
      timestamp: '2026-08-01T00:00:00.000Z',
      type: 'reply',
      title: 'Answered',
      outcome: 'done',
      source: {
        kind: 'reply',
        notification: {
          id: 'notif-1',
          kind: 'reply',
          entityId: 'IDEA-1',
          entityTitle: 'First idea',
          text: 'Answered',
          date: '2026-08-01T00:00:00.000Z',
          read: false,
          push: true,
        },
      },
    };
    const question: LogRow = {
      id: 'question:IDEA-1-0',
      timestamp: '2026-08-01T00:00:00.000Z',
      type: 'question',
      title: 'Which approach?',
      outcome: 'open',
      source: {
        kind: 'question',
        question: {
          entityId: 'IDEA-1',
          entityTitle: 'First idea',
          text: 'Which approach?',
          ageDays: 1,
        },
      },
    };
    const stats = computeLogStats([taskRow(), reply, question]);
    expect(stats.runs).toBe(1);
  });

  it('counts an error outcome as failed', () => {
    const stats = computeLogStats([taskRow({ outcome: 'done' }), taskRow({ outcome: 'error' })]);
    expect(stats.runs).toBe(2);
    expect(stats.failed).toBe(1);
  });

  it('computes success rate over settled runs only, excluding running and superseded', () => {
    const stats = computeLogStats([
      taskRow({ outcome: 'done' }),
      taskRow({ outcome: 'done' }),
      taskRow({ outcome: 'error' }),
      taskRow({ outcome: 'superseded' }),
      taskRow({ outcome: 'running' }),
    ]);
    expect(stats.successRate).toBeCloseTo(2 / 3);
  });

  it('leaves success rate undefined when nothing has settled yet', () => {
    const stats = computeLogStats([taskRow({ outcome: 'running' })]);
    expect(stats.successRate).toBeUndefined();
  });

  it('sums cost across the matched runs', () => {
    const stats = computeLogStats([
      taskRow({ costUsd: 0.2 }),
      taskRow({ costUsd: 0.3 }),
      taskRow({ costUsd: undefined }),
    ]);
    expect(stats.totalCostUsd).toBeCloseTo(0.5);
  });

  it('reports the median duration across runs that recorded one', () => {
    const stats = computeLogStats([
      taskRow({ durationMs: 100 }),
      taskRow({ durationMs: 300 }),
      taskRow({ durationMs: 200 }),
    ]);
    expect(stats.medianDurationMs).toBe(200);
  });

  it('averages the two middle durations for an even count', () => {
    const stats = computeLogStats([
      taskRow({ durationMs: 100 }),
      taskRow({ durationMs: 200 }),
      taskRow({ durationMs: 300 }),
      taskRow({ durationMs: 400 }),
    ]);
    expect(stats.medianDurationMs).toBe(250);
  });
});
