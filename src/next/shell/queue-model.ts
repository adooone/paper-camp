import type { BatchPreview, BatchPreviewItem } from '@/app/services/batch-api';
import type { BatchBacklogItem } from '@/core/batch-readiness';
import type { StampMeaning } from '../ui/stamp';

export const QUEUE_TABS = ['queue', 'backlog'] as const;

export type QueueTab = (typeof QUEUE_TABS)[number];

export const QUEUE_TAB_LABEL: Record<QueueTab, string> = {
  queue: 'Queue',
  backlog: 'Not queued',
};

export const QUEUE_EMPTY = {
  title: 'Nothing to run',
  line: 'The queue takes every idea that has phases and is planned, in progress or in review.',
};

export const BACKLOG_EMPTY = {
  title: 'Every idea is queued',
  line: 'Ideas without phases or a planned status wait here.',
};

const GIT_LEVEL_COPY: Record<BatchPreview['git']['level'], string> = {
  clean: 'Clean',
  behind: 'Behind origin',
  diverged: 'Diverged from origin',
  dirty: 'Uncommitted changes',
};

export const gitLevelCopy = (level: BatchPreview['git']['level']): string => GIT_LEVEL_COPY[level];

export const needsSync = (level: BatchPreview['git']['level']): boolean =>
  level === 'behind' || level === 'diverged';

export const formatCost = (usd: number | null): string =>
  usd === null ? '—' : `$${usd > 0 && usd < 0.01 ? '<0.01' : usd.toFixed(2)}`;

export const readyIds = (order: BatchPreviewItem[]): string[] =>
  order.filter((item) => item.readiness.ready).map((item) => item.id);

export const queueTotals = (
  order: BatchPreviewItem[],
  picked: ReadonlySet<string>,
): { count: number; phases: number; costUsd: number } => {
  const chosen = order.filter((item) => picked.has(item.id));
  return {
    count: chosen.length,
    phases: chosen.reduce((sum, item) => sum + item.phaseCount, 0),
    costUsd: chosen.reduce((sum, item) => sum + (item.costEstimateUsd ?? 0), 0),
  };
};

export const totalsLine = (totals: ReturnType<typeof queueTotals>): string =>
  `${totals.count} ${totals.count === 1 ? 'idea' : 'ideas'} · ${totals.phases} ${totals.phases === 1 ? 'phase' : 'phases'} · ~${formatCost(totals.costUsd)}`;

export const moveTarget = (index: number, direction: 1 | -1, length: number): number | null => {
  const target = index + direction;
  return target < 0 || target >= length ? null : target + 1;
};

export const itemDetail = (item: BatchPreviewItem): string =>
  `${item.phaseCount} ${item.phaseCount === 1 ? 'phase' : 'phases'} · ${formatCost(item.costEstimateUsd)}`;

export const readinessStamp = (item: BatchPreviewItem): { label: string; meaning: StampMeaning } =>
  item.readiness.ready
    ? { label: 'ready', meaning: 'done' }
    : { label: item.readiness.message, meaning: 'parked' };

export const pruneToReady = (picked: ReadonlySet<string>, order: BatchPreviewItem[]): Set<string> =>
  new Set(readyIds(order).filter((id) => picked.has(id)));

export const unplannedIds = (backlog: BatchBacklogItem[]): string[] =>
  backlog.filter((item) => !item.hasPhases).map((item) => item.id);
