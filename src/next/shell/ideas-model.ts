import type { EntityStatus, PlanStatus, WorklistEntry } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export type WorkTab = 'todo' | 'review' | 'done';

export const WORK_TABS: readonly WorkTab[] = ['todo', 'review', 'done'];

export const STATUS_ORDER: readonly PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

export const FOLDED_BY_DEFAULT: readonly PlanStatus[] = ['dropped'];

const TAB_STATUSES: Record<WorkTab, readonly PlanStatus[]> = {
  todo: ['in-progress', 'planned', 'idea'],
  review: ['review'],
  done: ['done', 'dropped'],
};

export const TAB_LABEL: Record<WorkTab, string> = {
  todo: 'To Do',
  review: 'Review',
  done: 'Done',
};

export const TAB_EMPTY: Record<WorkTab, string> = {
  todo: 'Nothing on the desk — draft an idea.',
  review: 'Nothing waiting for review.',
  done: 'Nothing finished yet.',
};

export const STATUS_HEADING: Record<PlanStatus, string> = {
  'in-progress': 'In progress',
  review: 'In review',
  planned: 'Planned',
  idea: 'Ideas',
  done: 'Done',
  dropped: 'Dropped',
};

export const STATUS_MEANING: Record<PlanStatus, StampMeaning> = {
  idea: 'parked',
  planned: 'parked',
  'in-progress': 'running',
  review: 'parked',
  done: 'done',
  dropped: 'failed',
};

export const STATUS_LABEL: Record<PlanStatus, string> = {
  idea: 'idea',
  planned: 'planned',
  'in-progress': 'in progress',
  review: 'review',
  done: 'done',
  dropped: 'dropped',
};

export interface IdeaGroup {
  status: PlanStatus;
  entries: WorklistEntry[];
}

export const statusOf = (entry: { status?: EntityStatus }): PlanStatus =>
  entry.status === undefined || entry.status === 'open' ? 'idea' : entry.status;

export const progressOf = (entry: WorklistEntry): string | null =>
  entry.phasesTotal === 0 ? null : `${entry.phasesDone} / ${entry.phasesTotal} phases`;

export const ideaGroups = (entries: readonly WorklistEntry[], tab: WorkTab): IdeaGroup[] =>
  STATUS_ORDER.filter((status) => TAB_STATUSES[tab].includes(status)).flatMap((status) => {
    const inGroup = entries.filter((entry) => statusOf(entry) === status);
    return inGroup.length > 0 ? [{ status, entries: inGroup }] : [];
  });

export const tabCounts = (entries: readonly WorklistEntry[]): Record<WorkTab, number> => {
  const counts: Record<WorkTab, number> = { todo: 0, review: 0, done: 0 };
  for (const entry of entries) {
    const status = statusOf(entry);
    for (const tab of WORK_TABS) {
      if (TAB_STATUSES[tab].includes(status)) counts[tab] += 1;
    }
  }
  return counts;
};

export const isFoldable = (status: PlanStatus): boolean => FOLDED_BY_DEFAULT.includes(status);
