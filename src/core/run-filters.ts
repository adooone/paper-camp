import {
  AGENT_IDS,
  type AgentId,
  type LogRow,
  type LogRowOutcome,
  type LogRowType,
} from '../types/index';

export type LogDateRange = 'today' | '7d' | '30d' | 'all';
export type LogSort = 'time' | 'duration' | 'cost';

const FILTERABLE_OUTCOMES: LogRowOutcome[] = ['done', 'error', 'superseded', 'open', 'interrupted'];
const DATE_RANGES: LogDateRange[] = ['today', '7d', '30d', 'all'];
const SORTS: LogSort[] = ['time', 'duration', 'cost'];

export interface LogFilters {
  outcomes: LogRowOutcome[];
  types: LogRowType[];
  agent?: AgentId;
  range: LogDateRange;
  q: string;
  sort: LogSort;
  unread: boolean;
}

export const DEFAULT_LOG_FILTERS: LogFilters = {
  outcomes: [],
  types: [],
  agent: undefined,
  range: 'all',
  q: '',
  sort: 'time',
  unread: false,
};

export interface LogSearchParams {
  outcome?: string;
  type?: string;
  agent?: string;
  range?: string;
  q?: string;
  sort?: string;
  unread?: string;
}

export function parseLogFilters(search: LogSearchParams): LogFilters {
  const outcomes = (search.outcome ?? '')
    .split(',')
    .filter((v): v is LogRowOutcome => FILTERABLE_OUTCOMES.includes(v as LogRowOutcome));
  const types = (search.type ?? '').split(',').filter(Boolean) as LogRowType[];
  const agent = AGENT_IDS.includes(search.agent as AgentId) ? (search.agent as AgentId) : undefined;
  const range = DATE_RANGES.includes(search.range as LogDateRange)
    ? (search.range as LogDateRange)
    : 'all';
  const sort = SORTS.includes(search.sort as LogSort) ? (search.sort as LogSort) : 'time';
  return { outcomes, types, agent, range, q: search.q ?? '', sort, unread: search.unread === '1' };
}

export function serializeLogFilters(filters: LogFilters): LogSearchParams {
  const params: LogSearchParams = {};
  if (filters.outcomes.length > 0) params.outcome = filters.outcomes.join(',');
  if (filters.types.length > 0) params.type = filters.types.join(',');
  if (filters.agent) params.agent = filters.agent;
  if (filters.range !== 'all') params.range = filters.range;
  if (filters.q.trim()) params.q = filters.q;
  if (filters.sort !== 'time') params.sort = filters.sort;
  if (filters.unread) params.unread = '1';
  return params;
}

const RANGE_WINDOW_MS: Record<Exclude<LogDateRange, 'all'>, number> = {
  today: 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function reasonFor(row: LogRow): string {
  if (row.source.kind === 'task') return row.source.entry.reason ?? '';
  if (row.source.kind === 'issue') return row.source.issue.reason;
  return '';
}

function matchesFilters(row: LogRow, filters: LogFilters, cutoff: number): boolean {
  if (filters.unread && !row.unread) return false;
  if (filters.outcomes.length > 0 && !filters.outcomes.includes(row.outcome)) return false;
  if (filters.types.length > 0 && !filters.types.includes(row.type)) return false;
  if (filters.agent && row.agentId !== filters.agent) return false;
  if (cutoff > 0 && Date.parse(row.timestamp) < cutoff) return false;
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const haystack = `${row.title} ${row.entityId ?? ''} ${reasonFor(row)}`.toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

const byDurationDesc = (a: LogRow, b: LogRow) => (b.durationMs ?? -1) - (a.durationMs ?? -1);
const byCostDesc = (a: LogRow, b: LogRow) => (b.costUsd ?? -1) - (a.costUsd ?? -1);

export function filterLogRows(
  rows: LogRow[],
  filters: LogFilters,
  now: number = Date.now(),
): LogRow[] {
  const cutoff = filters.range === 'all' ? 0 : now - RANGE_WINDOW_MS[filters.range];
  const matched = rows.filter((row) => matchesFilters(row, filters, cutoff));
  if (filters.sort === 'time') return matched;
  const running = matched.filter((row) => row.outcome === 'running');
  const settled = matched.filter((row) => row.outcome !== 'running');
  settled.sort(filters.sort === 'duration' ? byDurationDesc : byCostDesc);
  return [...running, ...settled];
}
