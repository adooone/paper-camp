import { isClosedEntity } from '@/core/status';
import type { EntityStatus, Issue, LogRow, RunUsage, TaskLogEntry } from '@/types/index';

const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const summaryLine = (lines: string[]): string | undefined => {
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  return trimmed.at(-1);
};

const EMPTY_USAGE: RunUsage = {
  durationMs: 0,
  numTurns: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  costUsd: 0,
};

export const usageForEntry = (entry: TaskLogEntry): RunUsage | undefined => {
  if (entry.usage) return entry.usage;
  if (!entry.phaseRuns?.length) return undefined;
  return entry.phaseRuns.reduce<RunUsage>(
    (acc, phase) => ({
      durationMs: acc.durationMs + phase.usage.durationMs,
      numTurns: acc.numTurns + phase.usage.numTurns,
      model: phase.usage.model ?? acc.model,
      inputTokens: acc.inputTokens + phase.usage.inputTokens,
      outputTokens: acc.outputTokens + phase.usage.outputTokens,
      cacheCreationTokens: acc.cacheCreationTokens + phase.usage.cacheCreationTokens,
      cacheReadTokens: acc.cacheReadTokens + phase.usage.cacheReadTokens,
      costUsd: acc.costUsd + phase.usage.costUsd,
    }),
    EMPTY_USAGE,
  );
};

export const formatCost = (usd: number): string => {
  if (usd === 0) return '$0';
  return usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`;
};

export const markReadIdFor = (row: LogRow): string | undefined => {
  if (!row.unread) return undefined;
  if (row.source.kind === 'task') return row.source.entry.id;
  if (row.source.kind === 'reply') return row.source.notification.id;
  return undefined;
};

export const promoteLabel = (
  issue: Issue,
  entities: { id: string; status?: EntityStatus; archived?: boolean }[],
): string => {
  const parent = issue.entityId ? entities.find((p) => p.id === issue.entityId) : undefined;
  if (!parent) return 'Promote to idea';
  return isClosedEntity(parent) ? 'Promote to fix' : `Add to ${parent.id}'s fixes`;
};
