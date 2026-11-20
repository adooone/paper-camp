import type { AgentTaskState, LogRow } from '@/types/index';

export type AttentionKind = 'questions' | 'failed' | 'findings' | 'running';

export interface AttentionLine {
  kind: AttentionKind;
  count: number;
  since?: string;
}

const isFailed = (outcome: string): boolean => outcome === 'error' || outcome === 'interrupted';

export function runningTasks(rows: LogRow[]): AgentTaskState[] {
  return rows.flatMap((row) => (row.source.kind === 'running' ? [row.source.task] : []));
}

const oldestStart = (startedAt: string[]): string | undefined => [...startedAt].sort()[0];

export function deriveAttention(rows: LogRow[]): AttentionLine[] {
  const questions = rows.filter((row) => row.source.kind === 'question').length;
  const failed = rows.filter((row) => row.unread && isFailed(row.outcome)).length;
  const findings = rows.filter(
    (row) =>
      row.unread &&
      row.source.kind === 'reply' &&
      row.source.notification.kind === 'night-review-findings',
  ).length;
  const running = runningTasks(rows);

  const lines: AttentionLine[] = [];
  if (questions > 0) lines.push({ kind: 'questions', count: questions });
  if (failed > 0) lines.push({ kind: 'failed', count: failed });
  if (findings > 0) lines.push({ kind: 'findings', count: findings });
  if (running.length > 0) {
    lines.push({
      kind: 'running',
      count: running.length,
      since: oldestStart(running.map((task) => task.startedAt)),
    });
  }
  return lines;
}
