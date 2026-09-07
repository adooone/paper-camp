import { isClosedEntity } from '@/core/status';
import type { EntityStatus, Issue, LogRow } from '@/types/index';

const pad = (n: number) => String(n).padStart(2, '0');

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatTime = (iso: string) => {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return isSameDay(d, new Date()) ? time : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${time}`;
};

export const summaryLine = (lines: string[]): string | undefined => {
  const trimmed = lines.map((line) => line.trim()).filter(Boolean);
  return trimmed.at(-1);
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
