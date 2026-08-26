import { isClosedEntity } from '@/core/status';
import type { EntityStatus, Issue } from '@/types/index';

export const promoteLabel = (
  issue: Issue,
  entities: { id: string; status?: EntityStatus; archived?: boolean }[],
): string => {
  const parent = issue.entityId ? entities.find((p) => p.id === issue.entityId) : undefined;
  if (!parent) return 'Promote to idea';
  return isClosedEntity(parent) ? 'Promote to fix' : `Add to ${parent.id}'s fixes`;
};

export const formatIssueAge = (occurredAt: string | undefined): string => {
  if (!occurredAt) return '';
  const ageDays = Math.floor((Date.now() - Date.parse(occurredAt)) / 86_400_000);
  if (!Number.isFinite(ageDays)) return '';
  if (ageDays <= 0) return 'today';
  return ageDays === 1 ? '1 day ago' : `${ageDays} days ago`;
};

// Missing timestamps (a live PR review decision) sort last, not first.
const NO_TIMESTAMP = '9999-12-31T23:59:59.999Z';
export const sortIssuesByAge = <T extends { occurredAt?: string }>(issues: T[]): T[] =>
  [...issues].sort((a, b) =>
    (a.occurredAt ?? NO_TIMESTAMP).localeCompare(b.occurredAt ?? NO_TIMESTAMP),
  );
