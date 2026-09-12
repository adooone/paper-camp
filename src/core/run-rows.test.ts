import { describe, expect, it } from 'vitest';
import type {
  AgentTaskState,
  Issue,
  ParkedQuestion,
  StoredNotification,
  TaskLogEntry,
} from '../types/index';
import { buildLogRows, interruptedNotices, resolveLogRow } from './run-rows';

const taskLogEntry = (overrides: Partial<TaskLogEntry> = {}): TaskLogEntry => ({
  id: 'task-1',
  taskKind: 'phase',
  planId: 'IDEA-1',
  planTitle: 'First idea',
  agentId: 'claude-code',
  startedAt: '2026-08-01T00:00:00.000Z',
  endedAt: '2026-08-01T00:05:00.000Z',
  outcome: 'done',
  ...overrides,
});

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'check:lint',
  sourceKind: 'check',
  sourceKey: 'lint',
  title: 'lint failing',
  reason: 'reason',
  occurredAt: '2026-08-01T00:00:00.000Z',
  thread: [],
  status: 'open',
  ...overrides,
});

const runningTask = (overrides: Partial<AgentTaskState> = {}): AgentTaskState => ({
  id: 'run-1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'First idea',
  startedAt: '2026-08-01T00:00:00.000Z',
  planId: 'IDEA-1',
  agentId: 'claude-code',
  lines: [],
  ...overrides,
});

const storedNotification = (overrides: Partial<StoredNotification> = {}): StoredNotification => ({
  id: 'task-1',
  kind: 'completed',
  entityId: 'IDEA-1',
  entityTitle: 'First idea',
  text: 'Phase run finished',
  date: '2026-08-01T00:05:00.000Z',
  read: false,
  push: true,
  ...overrides,
});

const parkedQuestion = (overrides: Partial<ParkedQuestion> = {}): ParkedQuestion => ({
  entityId: 'IDEA-1',
  entityTitle: 'First idea',
  text: 'Which approach?',
  date: '2026-08-01T00:00:00.000Z',
  ageDays: 1,
  ...overrides,
});

describe('interruptedNotices', () => {
  it('surfaces a plan whose latest entry never finished', () => {
    const notices = interruptedNotices([
      taskLogEntry({
        outcome: 'interrupted',
        reason: 'the server stopped while this task was running',
      }),
    ]);
    expect(notices.map((e) => e.planId)).toEqual(['IDEA-1']);
  });

  it('drops a plan once a newer run has started on it', () => {
    const notices = interruptedNotices([
      taskLogEntry({ id: 'task-1', outcome: 'interrupted', startedAt: '2026-08-01T00:00:00.000Z' }),
      taskLogEntry({
        id: 'task-2',
        startedAt: '2026-08-02T00:00:00.000Z',
        endedAt: undefined,
        outcome: undefined,
      }),
    ]);
    expect(notices).toEqual([]);
  });

  it('ignores entries with no plan and finished entries', () => {
    const notices = interruptedNotices([
      taskLogEntry({ planId: undefined, outcome: 'interrupted' }),
      taskLogEntry({ outcome: 'done' }),
    ]);
    expect(notices).toEqual([]);
  });
});

describe('buildLogRows', () => {
  it('turns every tasks.log entry into a row, whatever its outcome', () => {
    const rows = buildLogRows(
      [
        taskLogEntry({ outcome: 'done' }),
        taskLogEntry({
          id: 'task-2',
          outcome: 'error',
          endedAt: '2026-08-02T00:00:00.000Z',
        }),
      ],
      [],
      [],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(['task:task-2', 'task:task-1']);
    expect(rows[1]).toMatchObject({ type: 'phase', outcome: 'done', entityId: 'IDEA-1' });
  });

  it('turns a failure with no run behind it into a row of its own type', () => {
    const rows = buildLogRows([], [issue({ sourceKind: 'sync' })], [], []);
    expect(rows).toEqual([
      expect.objectContaining({ id: 'issue:check:lint', type: 'sync', outcome: 'open' }),
    ]);
  });

  it('excludes an agent-run issue — its tasks.log error entry already carries it', () => {
    const rows = buildLogRows([], [issue({ sourceKind: 'agent-run' })], [], []);
    expect(rows).toEqual([]);
  });

  it('puts a task in flight at the top with a running stamp', () => {
    const rows = buildLogRows(
      [taskLogEntry({ endedAt: '2026-08-02T00:00:00.000Z' })],
      [],
      [runningTask()],
      [],
    );
    expect(rows[0]).toMatchObject({ id: 'running:run-1', outcome: 'running' });
    expect(rows[1].id).toBe('task:task-1');
  });

  it('excludes a task that has already settled from the live set', () => {
    const rows = buildLogRows([], [], [runningTask({ status: 'done' })], []);
    expect(rows).toEqual([]);
  });

  it('reads a task row cost straight off its usage', () => {
    const rows = buildLogRows(
      [
        taskLogEntry({
          usage: {
            durationMs: 1000,
            numTurns: 1,
            inputTokens: 1,
            outputTokens: 1,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            costUsd: 0.5,
          },
        }),
      ],
      [],
      [],
      [],
    );
    expect(rows[0].costUsd).toBe(0.5);
  });

  it('sums a task row cost across phase runs when there is no top-level usage', () => {
    const rows = buildLogRows(
      [
        taskLogEntry({
          phaseRuns: [
            {
              kind: 'phase',
              index: 0,
              usage: {
                durationMs: 1000,
                numTurns: 1,
                inputTokens: 1,
                outputTokens: 1,
                cacheCreationTokens: 0,
                cacheReadTokens: 0,
                costUsd: 0.2,
              },
            },
            {
              kind: 'phase',
              index: 1,
              usage: {
                durationMs: 1000,
                numTurns: 1,
                inputTokens: 1,
                outputTokens: 1,
                cacheCreationTokens: 0,
                cacheReadTokens: 0,
                costUsd: 0.3,
              },
            },
          ],
        }),
      ],
      [],
      [],
      [],
    );
    expect(rows[0].costUsd).toBeCloseTo(0.5);
  });

  it('sorts the settled rows newest first regardless of source', () => {
    const rows = buildLogRows(
      [taskLogEntry({ endedAt: '2026-08-01T00:00:00.000Z' })],
      [issue({ occurredAt: '2026-08-02T00:00:00.000Z', sourceKind: 'check' })],
      [],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(['issue:check:lint', 'task:task-1']);
  });

  it('decorates a task row with unread when an unread completed notification matches its id', () => {
    const rows = buildLogRows([taskLogEntry()], [], [], [storedNotification({ read: false })]);
    expect(rows[0].unread).toBe(true);
  });

  it('leaves a task row read once its completed notification is read', () => {
    const rows = buildLogRows([taskLogEntry()], [], [], [storedNotification({ read: true })]);
    expect(rows[0].unread).toBe(false);
  });

  it('turns a reply notification into a row of its own, unread until read', () => {
    const rows = buildLogRows(
      [],
      [],
      [],
      [
        storedNotification({
          id: 'notif-1',
          kind: 'reply',
          text: 'Answered the question',
          read: false,
        }),
      ],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'notification:notif-1',
        type: 'reply',
        outcome: 'done',
        title: 'Answered the question',
        unread: true,
      }),
    ]);
  });

  it('turns a parked question into a row of its own, always unread', () => {
    const rows = buildLogRows([], [], [], [{ ...parkedQuestion(), kind: 'question' }]);
    expect(rows).toEqual([
      expect.objectContaining({
        id: 'question:IDEA-1-2026-08-01T00:00:00.000Z',
        type: 'question',
        outcome: 'open',
        title: 'Which approach?',
        unread: true,
      }),
    ]);
  });
});

describe('resolveLogRow', () => {
  const rows = buildLogRows([taskLogEntry()], [], [], []);

  it('resolves the row whose id matches exactly', () => {
    expect(resolveLogRow(rows, 'task:task-1')?.id).toBe('task:task-1');
  });

  it('falls back from a settled task id to its still-running row', () => {
    const running = buildLogRows([], [], [runningTask({ id: 'run-1' })], []);
    expect(resolveLogRow(running, 'task:run-1')?.id).toBe('running:run-1');
  });

  it('falls back from a running id to its settled task row', () => {
    expect(resolveLogRow(rows, 'running:task-1')?.id).toBe('task:task-1');
  });

  it('returns undefined when nothing matches either prefix', () => {
    expect(resolveLogRow(rows, 'task:does-not-exist')).toBeUndefined();
  });

  it('returns undefined for a prefix with no running/task counterpart', () => {
    const notifRows = buildLogRows(
      [],
      [],
      [],
      [storedNotification({ id: 'notif-1', kind: 'reply' })],
    );
    expect(resolveLogRow(notifRows, 'notification:does-not-exist')).toBeUndefined();
  });
});
