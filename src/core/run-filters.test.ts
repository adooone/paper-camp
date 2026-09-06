import { describe, expect, it } from 'vitest';
import type { LogRow } from '../types/index';
import {
  DEFAULT_LOG_FILTERS,
  type LogFilters,
  filterLogRows,
  parseLogFilters,
  serializeLogFilters,
} from './run-filters';

const row = (overrides: Partial<LogRow> = {}): LogRow => ({
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

describe('parseLogFilters', () => {
  it('defaults to the empty filter set', () => {
    expect(parseLogFilters({})).toEqual(DEFAULT_LOG_FILTERS);
  });

  it('splits comma-separated outcome and type lists', () => {
    const filters = parseLogFilters({ outcome: 'done,error', type: 'phase,check' });
    expect(filters.outcomes).toEqual(['done', 'error']);
    expect(filters.types).toEqual(['phase', 'check']);
  });

  it('drops a filterable outcome that is not one of the four options', () => {
    const filters = parseLogFilters({ outcome: 'done,running,bogus' });
    expect(filters.outcomes).toEqual(['done']);
  });

  it('drops an agent, range, or sort value it does not recognise', () => {
    const filters = parseLogFilters({ agent: 'bogus', range: 'bogus', sort: 'bogus' });
    expect(filters.agent).toBeUndefined();
    expect(filters.range).toBe('all');
    expect(filters.sort).toBe('time');
  });

  it('round-trips through serializeLogFilters', () => {
    const filters: LogFilters = {
      outcomes: ['error'],
      types: ['phase'],
      agent: 'claude-code',
      range: '7d',
      q: 'reconcile',
      sort: 'cost',
      unread: true,
    };
    expect(parseLogFilters(serializeLogFilters(filters))).toEqual(filters);
  });

  it('serializes the default filters to an empty params object', () => {
    expect(serializeLogFilters(DEFAULT_LOG_FILTERS)).toEqual({});
  });

  it('reads unread only from the literal "1"', () => {
    expect(parseLogFilters({ unread: '1' }).unread).toBe(true);
    expect(parseLogFilters({ unread: 'true' }).unread).toBe(false);
    expect(parseLogFilters({}).unread).toBe(false);
  });
});

describe('filterLogRows', () => {
  it('passes every row through when no filter is set', () => {
    const rows = [row(), row({ id: 'task:task-2', outcome: 'error' })];
    expect(filterLogRows(rows, DEFAULT_LOG_FILTERS)).toHaveLength(2);
  });

  it('matches outcome', () => {
    const rows = [row({ outcome: 'done' }), row({ id: 'task:task-2', outcome: 'error' })];
    const filtered = filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, outcomes: ['error'] });
    expect(filtered.map((r) => r.id)).toEqual(['task:task-2']);
  });

  it('matches type', () => {
    const rows = [row({ type: 'phase' }), row({ id: 'task:task-2', type: 'audit' })];
    const filtered = filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, types: ['audit'] });
    expect(filtered.map((r) => r.id)).toEqual(['task:task-2']);
  });

  it('matches agent', () => {
    const rows = [row({ agentId: 'claude-code' }), row({ id: 'task:task-2', agentId: 'opencode' })];
    const filtered = filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, agent: 'opencode' });
    expect(filtered.map((r) => r.id)).toEqual(['task:task-2']);
  });

  it('matches title, entity id, or reason for a search term', () => {
    const rows = [
      row({ id: 'task:by-title', title: 'Reconcile the queue' }),
      row({ id: 'task:by-entity', entityId: 'IDEA-99' }),
      row({
        id: 'task:by-reason',
        source: {
          kind: 'task',
          entry: {
            id: 'task-3',
            taskKind: 'phase',
            planTitle: 'Unrelated',
            agentId: 'claude-code',
            startedAt: '2026-08-01T00:00:00.000Z',
            endedAt: '2026-08-01T00:00:00.000Z',
            outcome: 'error',
            reason: 'rate limited',
          },
        },
      }),
      row({ id: 'task:no-match', title: 'Something else', entityId: 'IDEA-1' }),
    ];
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, q: 'reconcile' }).map((r) => r.id),
    ).toEqual(['task:by-title']);
    expect(filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, q: 'idea-99' }).map((r) => r.id)).toEqual([
      'task:by-entity',
    ]);
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, q: 'rate limited' }).map((r) => r.id),
    ).toEqual(['task:by-reason']);
  });

  it('drops rows older than the selected range', () => {
    const now = Date.parse('2026-08-10T00:00:00.000Z');
    const rows = [
      row({ id: 'task:today', timestamp: '2026-08-09T12:00:00.000Z' }),
      row({ id: 'task:old', timestamp: '2026-07-01T00:00:00.000Z' }),
    ];
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, range: 'today' }, now).map((r) => r.id),
    ).toEqual(['task:today']);
  });

  it('leaves time-sorted order alone by default', () => {
    const rows = [row({ id: 'task:a', durationMs: 100 }), row({ id: 'task:b', durationMs: 900 })];
    expect(filterLogRows(rows, DEFAULT_LOG_FILTERS).map((r) => r.id)).toEqual(['task:a', 'task:b']);
  });

  it('sorts by duration, longest first, once asked', () => {
    const rows = [row({ id: 'task:a', durationMs: 100 }), row({ id: 'task:b', durationMs: 900 })];
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, sort: 'duration' }).map((r) => r.id),
    ).toEqual(['task:b', 'task:a']);
  });

  it('sorts by cost, priciest first, once asked', () => {
    const rows = [row({ id: 'task:a', costUsd: 0.1 }), row({ id: 'task:b', costUsd: 4.2 })];
    expect(filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, sort: 'cost' }).map((r) => r.id)).toEqual([
      'task:b',
      'task:a',
    ]);
  });

  it('keeps a running row pinned above the sorted settled rows', () => {
    const rows = [
      row({ id: 'task:settled', durationMs: 900, outcome: 'done' }),
      row({
        id: 'task:running',
        outcome: 'running',
        source: {
          kind: 'running',
          task: {
            id: 'run-1',
            status: 'running',
            taskKind: 'phase',
            planTitle: 'Live run',
            startedAt: '2026-08-01T00:00:00.000Z',
            agentId: 'claude-code',
            lines: [],
          },
        },
      }),
    ];
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, sort: 'duration' }).map((r) => r.id),
    ).toEqual(['task:running', 'task:settled']);
  });

  it('matches only unread rows once asked', () => {
    const rows = [
      row({ id: 'task:read', unread: false }),
      row({ id: 'task:unread', unread: true }),
    ];
    expect(filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, unread: true }).map((r) => r.id)).toEqual([
      'task:unread',
    ]);
  });

  it('hides a running row once an outcome filter is set, since running is not one of the four options', () => {
    const rows = [
      row({ id: 'task:done', outcome: 'done' }),
      row({
        id: 'task:running',
        outcome: 'running',
        source: {
          kind: 'running',
          task: {
            id: 'run-1',
            status: 'running',
            taskKind: 'phase',
            planTitle: 'Live run',
            startedAt: '2026-08-01T00:00:00.000Z',
            agentId: 'claude-code',
            lines: [],
          },
        },
      }),
    ];
    expect(
      filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, outcomes: ['done'] }).map((r) => r.id),
    ).toEqual(['task:done']);
  });
});
