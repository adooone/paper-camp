import { describe, expect, it } from 'vitest';
import type { AgentTaskState, LogRow, StoredNotification } from '@/types/index';
import { deriveAttention, runningTasks } from './attention';

const base = { id: 'row', timestamp: '2026-11-20T10:00:00Z', title: 'Row', type: 'phase' } as const;

const task = (id: string, startedAt: string): AgentTaskState =>
  ({ id, planTitle: id, startedAt, status: 'running', lines: [] }) as unknown as AgentTaskState;

const taskRow = (outcome: LogRow['outcome'], unread: boolean): LogRow => ({
  ...base,
  outcome,
  unread,
  source: { kind: 'task', entry: {} as never },
});

const replyRow = (kind: StoredNotification['kind'], unread: boolean): LogRow => ({
  ...base,
  type: 'reply',
  outcome: 'done',
  unread,
  source: { kind: 'reply', notification: { kind } as StoredNotification },
});

const questionRow = (): LogRow => ({
  ...base,
  type: 'question',
  outcome: 'open',
  source: { kind: 'question', question: {} as never },
});

const runningRow = (id: string, startedAt: string): LogRow => ({
  ...base,
  outcome: 'running',
  source: { kind: 'running', task: task(id, startedAt) },
});

describe('deriveAttention', () => {
  it('is empty when nothing needs attention', () => {
    expect(deriveAttention([taskRow('done', false)])).toEqual([]);
  });

  it('counts questions, unread failures, unread findings and live runs in that order', () => {
    const lines = deriveAttention([
      runningRow('b', '2026-11-20T09:30:00Z'),
      runningRow('a', '2026-11-20T09:00:00Z'),
      questionRow(),
      taskRow('error', true),
      taskRow('interrupted', true),
      taskRow('error', false),
      replyRow('night-review-findings', true),
      replyRow('night-review-findings', false),
      replyRow('completed', true),
    ]);
    expect(lines).toEqual([
      { kind: 'questions', count: 1 },
      { kind: 'failed', count: 2 },
      { kind: 'findings', count: 1 },
      { kind: 'running', count: 2, since: '2026-11-20T09:00:00Z' },
    ]);
  });
});

describe('runningTasks', () => {
  it('lifts the task out of each running row', () => {
    const rows = [runningRow('a', '2026-11-20T09:00:00Z'), taskRow('done', false)];
    expect(runningTasks(rows).map((entry) => entry.id)).toEqual(['a']);
  });
});
