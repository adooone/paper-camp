import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AgentTaskState, LogRow, TaskLogEntry } from '@/types/index';
import type { EntryScreenState } from '../hooks/use-entry-screen';
import { EntryView } from '../log/entry-view';
import { LogChips } from '../log/log-chips';
import {
  applyFilters,
  discussTarget,
  EMPTY_FILTERS,
  earnsStamp,
  entryMetrics,
  liveTaskFor,
  OUTCOME_CHIPS,
  outcomeLabel,
  outcomeMeaning,
  parkedFor,
  rowTitle,
  splitRows,
  TYPE_CHIPS,
  toggled,
} from './log-model';

const noop = () => {};

const entry = (extra: Partial<TaskLogEntry> = {}): TaskLogEntry => ({
  id: 't1',
  taskKind: 'phase',
  planId: 'IDEA-7',
  planTitle: 'Make it sing',
  agentId: 'claude-code',
  startedAt: '2026-11-02T10:00:00.000Z',
  endedAt: '2026-11-02T10:05:00.000Z',
  outcome: 'done',
  usage: {
    durationMs: 12_500,
    numTurns: 4,
    inputTokens: 100,
    outputTokens: 50,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0.5,
  },
  ...extra,
});

const task = (extra: Partial<AgentTaskState> = {}): AgentTaskState => ({
  id: 'r1',
  status: 'running',
  taskKind: 'phase',
  planTitle: 'Make it sing',
  planId: 'IDEA-7',
  startedAt: '2026-11-02T10:00:00.000Z',
  agentId: 'claude-code',
  lines: [],
  ...extra,
});

const taskRow = (extra: Partial<LogRow> = {}): LogRow => ({
  id: 'task:t1',
  timestamp: '2026-11-02T10:05:00.000Z',
  type: 'phase',
  entityId: 'IDEA-7',
  entityTitle: 'Make it sing',
  title: 'Make it sing',
  outcome: 'done',
  source: { kind: 'task', entry: entry() },
  ...extra,
});

const questionRow = (): LogRow => ({
  id: 'question:IDEA-7-1',
  timestamp: '2026-11-02T11:00:00.000Z',
  type: 'question',
  entityId: 'IDEA-7',
  entityTitle: 'Make it sing',
  title: 'Which key?',
  outcome: 'open',
  unread: true,
  source: {
    kind: 'question',
    question: { entityId: 'IDEA-7', entityTitle: 'Make it sing', text: 'Which key?', ageDays: 2 },
  },
});

const runningRow = (): LogRow => ({
  id: 'running:r1',
  timestamp: '2026-11-02T10:00:00.000Z',
  type: 'phase',
  entityId: 'IDEA-7',
  entityTitle: 'Make it sing',
  title: 'Make it sing',
  outcome: 'running',
  source: { kind: 'running', task: task() },
});

const screen = (extra: Partial<EntryScreenState> = {}): EntryScreenState => ({
  live: null,
  discussId: undefined,
  busy: null,
  error: null,
  stop: noop,
  markRead: noop,
  ...extra,
});

describe('filters', () => {
  it('offers the phone outcome chips in order, with open as parked', () => {
    expect(OUTCOME_CHIPS.map((chip) => [chip.label, chip.meaning])).toEqual([
      ['done', 'done'],
      ['failed', 'failed'],
      ['running', 'running'],
      ['open', 'parked'],
    ]);
  });

  it('lists only types the desk log can carry', () => {
    expect(TYPE_CHIPS.map((chip) => chip.label)).toEqual([
      'phase',
      'feedback',
      'run-all',
      'audit',
      'pr-review',
      'sync',
      'reply',
      'question',
    ]);
  });

  it('toggles a value in and out of a list', () => {
    expect(toggled(['done'], 'error')).toEqual(['done', 'error']);
    expect(toggled(['done', 'error'], 'done')).toEqual(['error']);
  });

  it('keeps only matching outcomes and types', () => {
    const rows = [taskRow(), questionRow(), runningRow()];
    expect(applyFilters(rows, EMPTY_FILTERS)).toHaveLength(3);
    expect(applyFilters(rows, { outcomes: ['open'], types: [] }).map((row) => row.id)).toEqual([
      'question:IDEA-7-1',
    ]);
    expect(applyFilters(rows, { outcomes: [], types: ['phase'] })).toHaveLength(2);
  });

  it('splits open rows into a waiting group', () => {
    const { waiting, feed } = splitRows([taskRow(), questionRow()]);
    expect(waiting.map((row) => row.id)).toEqual(['question:IDEA-7-1']);
    expect(feed.map((row) => row.id)).toEqual(['task:t1']);
  });
});

describe('stamps', () => {
  it('stays silent for done and idle only', () => {
    expect(earnsStamp('done')).toBe(false);
    expect(earnsStamp('idle')).toBe(false);
    expect(earnsStamp('failed')).toBe(true);
    expect(earnsStamp(outcomeMeaning.interrupted)).toBe(true);
  });

  it('words every outcome', () => {
    expect(outcomeLabel.error).toBe('failed');
    expect(outcomeMeaning.superseded).toBe('parked');
  });
});

describe('rows', () => {
  it('titles a row by its idea when it has one', () => {
    expect(rowTitle(taskRow())).toBe('Make it sing');
    expect(rowTitle(taskRow({ entityTitle: undefined, title: 'Raw' }))).toBe('Raw');
  });

  it('finds the live task behind a finished row of the same idea', () => {
    const live = task({ id: 'r2' });
    expect(liveTaskFor(taskRow(), [live])).toBe(live);
    expect(liveTaskFor(taskRow(), [task({ planId: 'IDEA-9' })])).toBeNull();
    expect(liveTaskFor(runningRow(), [])?.id).toBe('r1');
    expect(liveTaskFor(questionRow(), [live])).toBeNull();
  });

  it('offers a chat only for a parked question', () => {
    expect(discussTarget(questionRow(), null)).toBe('IDEA-7');
    expect(discussTarget(runningRow(), task({ errorKind: 'question' }))).toBe('IDEA-7');
    expect(discussTarget(runningRow(), task())).toBeUndefined();
  });

  it('lays out the run metrics, dashing what is missing', () => {
    const metrics = entryMetrics(entry());
    expect(metrics.map((metric) => metric.label)).toEqual([
      'started',
      'ended',
      'duration',
      'turns',
      'tokens',
      'cost',
    ]);
    expect(metrics.find((metric) => metric.label === 'duration')?.value).toBe('12.5s');
    expect(metrics.find((metric) => metric.label === 'tokens')?.value).toBe('150');
    expect(metrics.find((metric) => metric.label === 'cost')?.value).toBe('$0.50');
    const bare = entryMetrics(entry({ usage: undefined, endedAt: undefined }));
    expect(bare.find((metric) => metric.label === 'ended')?.value).toBe('—');
    expect(bare.find((metric) => metric.label === 'cost')?.value).toBe('—');
  });

  it('words a question age', () => {
    expect(parkedFor(2)).toBe('2d');
    expect(parkedFor(Number.NaN)).toBe('a while');
  });
});

describe('LogChips', () => {
  it('marks the active chips pressed', () => {
    const html = renderToStaticMarkup(
      <LogChips
        filters={{ outcomes: ['error'], types: ['sync'] }}
        onToggleOutcome={noop}
        onToggleType={noop}
      />,
    );
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(html.match(/<button/g)).toHaveLength(OUTCOME_CHIPS.length + TYPE_CHIPS.length);
  });
});

describe('EntryView', () => {
  const render = (row: LogRow, state: EntryScreenState, onBack?: () => void) =>
    renderToStaticMarkup(
      <EntryView row={row} screen={state} onBack={onBack} onOpenIdea={noop} onDiscuss={noop} />,
    );

  it('shows a finished run as a card with metrics and a way to the idea', () => {
    const html = render(taskRow(), screen(), noop);
    expect(html).toContain('Make it sing');
    expect(html).toContain('phase · claude-code');
    expect(html).toContain('Open idea IDEA-7');
    expect(html).toContain('← Back');
    expect(html).not.toContain('Output');
    expect(html).not.toContain('Stop');
  });

  it('shows a running run with its output board and a stop', () => {
    const html = render(runningRow(), screen({ live: task() }));
    expect(html).toContain('Live task');
    expect(html).toContain('Output');
    expect(html).toContain('Stop');
    expect(html).not.toContain('← Back');
  });

  it('offers the chat for a parked question row', () => {
    const html = render(questionRow(), screen({ discussId: 'IDEA-7' }));
    expect(html).toContain('parked for 2d');
    expect(html).toContain('Discuss in chat');
  });

  it('offers mark read for an unread reply and disables it once read', () => {
    const reply = (read: boolean): LogRow => ({
      id: 'notification:n1',
      timestamp: '2026-11-02T12:00:00.000Z',
      type: 'reply',
      entityId: 'IDEA-7',
      entityTitle: 'Make it sing',
      title: 'Hello',
      outcome: 'done',
      unread: !read,
      source: {
        kind: 'reply',
        notification: {
          id: 'n1',
          kind: 'reply',
          entityId: 'IDEA-7',
          entityTitle: 'Make it sing',
          text: 'Hello',
          date: '2026-11-02T12:00:00.000Z',
          read,
          push: false,
        },
      },
    });
    expect(render(reply(false), screen())).toContain('Mark read');
    const read = render(reply(true), screen());
    expect(read).toContain('Already read');
    expect(read).toContain('disabled');
  });
});
