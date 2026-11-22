import { DEFAULT_LOG_FILTERS, filterLogRows } from '@/core/run-filters';
import { usageForEntry } from '@/core/run-rows';
import type {
  AgentTaskState,
  LogRow,
  LogRowOutcome,
  LogRowType,
  TaskLogEntry,
} from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export interface OutcomeChip {
  id: LogRowOutcome;
  label: string;
  meaning: StampMeaning;
}

export const OUTCOME_CHIPS: readonly OutcomeChip[] = [
  { id: 'done', label: 'done', meaning: 'done' },
  { id: 'error', label: 'failed', meaning: 'failed' },
  { id: 'running', label: 'running', meaning: 'running' },
  { id: 'open', label: 'open', meaning: 'parked' },
];

const TYPE_IDS: readonly LogRowType[] = [
  'phase',
  'feedback',
  'run-all',
  'audit',
  'pr-review',
  'sync',
  'reply',
  'question',
];

export const TYPE_CHIPS: readonly { id: LogRowType; label: string }[] = TYPE_IDS.map((id) => ({
  id,
  label: id,
}));

export interface LogFilterState {
  outcomes: LogRowOutcome[];
  types: LogRowType[];
}

export const EMPTY_FILTERS: LogFilterState = { outcomes: [], types: [] };

export function toggled<T>(list: readonly T[], id: T): T[] {
  return list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
}

export function applyFilters(rows: LogRow[], filters: LogFilterState): LogRow[] {
  return filterLogRows(rows, { ...DEFAULT_LOG_FILTERS, ...filters });
}

export function splitRows(rows: LogRow[]): { waiting: LogRow[]; feed: LogRow[] } {
  return {
    waiting: rows.filter((row) => row.outcome === 'open'),
    feed: rows.filter((row) => row.outcome !== 'open'),
  };
}

export const outcomeLabel: Record<LogRowOutcome, string> = {
  done: 'done',
  error: 'failed',
  superseded: 'superseded',
  running: 'running',
  open: 'open',
  interrupted: 'interrupted',
};

export const outcomeMeaning: Record<LogRowOutcome, StampMeaning> = {
  done: 'done',
  error: 'failed',
  superseded: 'parked',
  running: 'running',
  open: 'parked',
  interrupted: 'failed',
};

const SILENT: readonly StampMeaning[] = ['idle', 'done'];

export const earnsStamp = (meaning: StampMeaning): boolean => !SILENT.includes(meaning);

export const rowTitle = (row: LogRow): string => row.entityTitle ?? row.title;

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const isLive = (task: AgentTaskState): boolean =>
  task.status === 'starting' || task.status === 'running' || task.status === 'stopping';

export const taskEntityId = (task: AgentTaskState): string | undefined =>
  task.planId ?? task.ideaId;

export function liveTaskFor(row: LogRow, tasks: AgentTaskState[]): AgentTaskState | null {
  if (row.source.kind === 'running') return row.source.task;
  if (row.source.kind !== 'task') return null;
  const planId = row.source.entry.planId;
  if (!planId) return null;
  return tasks.find((task) => taskEntityId(task) === planId && isLive(task)) ?? null;
}

export function discussTarget(row: LogRow, live: AgentTaskState | null): string | undefined {
  if (row.source.kind === 'question') return row.source.question.entityId;
  return live?.errorKind === 'question' ? taskEntityId(live) : undefined;
}

export interface Metric {
  label: string;
  value: string;
}

export function entryMetrics(entry: TaskLogEntry): Metric[] {
  const usage = usageForEntry(entry);
  return [
    { label: 'started', value: formatDate(entry.startedAt) },
    { label: 'ended', value: formatDate(entry.endedAt) || '—' },
    { label: 'duration', value: usage ? `${(usage.durationMs / 1000).toFixed(1)}s` : '—' },
    { label: 'turns', value: usage ? String(usage.numTurns) : '—' },
    { label: 'tokens', value: usage ? String(usage.inputTokens + usage.outputTokens) : '—' },
    { label: 'cost', value: usage ? `$${usage.costUsd.toFixed(2)}` : '—' },
  ];
}

export function parkedFor(ageDays: number): string {
  return Number.isFinite(ageDays) ? `${ageDays}d` : 'a while';
}
