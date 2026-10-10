import type { LogRow, ThreadMessage } from '../types/index';
import type { LogSort } from './run-filters';

export type ActivityEntry =
  | { entryKind: 'run'; timestamp: string; row: LogRow }
  | { entryKind: 'chat'; timestamp: string; message: ThreadMessage; index: number };

const EPOCH = new Date(0).toISOString();

const byNewest = (a: ActivityEntry, b: ActivityEntry) => b.timestamp.localeCompare(a.timestamp);

/** Runs and chat messages share one time-ordered stream (IDEA-290); a non-time
 * sort only orders runs, so chat entries — which carry no duration or cost —
 * settle after them, the same place a run with neither value would land. */
export function buildActivityEntries(
  runRows: LogRow[],
  chatMessages: ThreadMessage[],
  sort: LogSort,
): ActivityEntry[] {
  const runEntries: ActivityEntry[] = runRows.map((row) => ({
    entryKind: 'run',
    timestamp: row.timestamp,
    row,
  }));
  const chatEntries: ActivityEntry[] = chatMessages.map((message, index) => ({
    entryKind: 'chat',
    timestamp: message.date ?? EPOCH,
    message,
    index,
  }));

  if (sort !== 'time') return [...runEntries, ...chatEntries];

  const running = runEntries.filter((e) => e.entryKind === 'run' && e.row.outcome === 'running');
  const rest = runEntries.filter((e) => !(e.entryKind === 'run' && e.row.outcome === 'running'));
  return [...running, ...[...rest, ...chatEntries].sort(byNewest)];
}
