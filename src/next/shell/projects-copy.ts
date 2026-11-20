import type { AttentionKind, AttentionLine } from '@/app/stores/attention';
import type { AgentTaskState } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export const attentionMeaning: Record<AttentionKind, StampMeaning> = {
  questions: 'parked',
  failed: 'failed',
  findings: 'parked',
  running: 'running',
};

const plural = (count: number, one: string, many: string): string => (count === 1 ? one : many);

const minutesSince = (start: string | undefined, now: number): string => {
  const at = start ? Date.parse(start) : Number.NaN;
  if (Number.isNaN(at)) return '';
  return ` · ${Math.max(0, Math.floor((now - at) / 60000))}m`;
};

export function attentionTitle(line: AttentionLine, now: number): string {
  switch (line.kind) {
    case 'questions':
      return `${line.count} ${plural(line.count, 'question', 'questions')} waiting`;
    case 'failed':
      return `${line.count} ${plural(line.count, 'run', 'runs')} failed`;
    case 'findings':
      return `Night shift found ${line.count} ${plural(line.count, 'thing', 'things')}`;
    case 'running':
      return `${line.count} ${plural(line.count, 'run', 'runs')} going${minutesSince(line.since, now)}`;
  }
}

export function formatElapsed(start: string, now: number): string {
  const startedAt = Date.parse(start);
  if (Number.isNaN(startedAt)) return '…';
  const seconds = Math.floor(Math.max(0, now - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function runDetail(task: AgentTaskState, total: number | undefined, now: number): string {
  const phase =
    task.phaseIndex == null
      ? null
      : total
        ? `phase ${task.phaseIndex + 1} of ${total}`
        : `phase ${task.phaseIndex + 1}`;
  return [phase, formatElapsed(task.startedAt, now)].filter(Boolean).join(' · ');
}

export function newestLine(task: AgentTaskState): string | undefined {
  return task.lines
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
}
