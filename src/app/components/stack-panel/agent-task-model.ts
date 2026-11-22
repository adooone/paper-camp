import type { ScopeRow } from '@/app/features/scope';
import { interruptedNotices, logRowIdForTask } from '@/core/run-rows';
import type {
  AgentTaskState,
  Notification,
  PlanEntry,
  StoredNotification,
  TaskKind,
  TaskLogEntry,
} from '@/types/index';

export interface ScopedNotice {
  entry: TaskLogEntry;
  project?: ScopeRow;
}

export const foreignProject = (project?: ScopeRow): ScopeRow | undefined =>
  project && !project.isCurrent ? project : undefined;

const isStoredNotification = (n: Notification): n is StoredNotification => n.kind !== 'question';

export const readNotificationIds = (list: Notification[]): string[] =>
  list
    .filter(isStoredNotification)
    .filter((n) => n.read)
    .map((n) => n.id);

export const taskKindLabel = (task: AgentTaskState): string => {
  switch (task.taskKind) {
    case 'phase':
      return task.phaseIndex !== undefined ? `phase ${task.phaseIndex + 1}` : '';
    case 'audit':
      return 'audit';
    case 'batch-reconcile':
      return 'batch reconcile';
    case 'batch-draft':
      return 'batch draft';
    case 'reconcile':
      return 'reconcile';
    case 'fix-review':
      return 'fixing review comments';
    case 'draft':
      return 'drafting';
    case 'extend':
      return 'extending';
    case 'commit-suggest':
      return 'suggesting commit message';
    case 'overlap-check':
      return 'checking overlap';
    case 'sync':
      return 'syncing to main';
    case 'resolve-conflict':
      return 'resolving conflict';
    case 'run-all':
      return 'run all phases';
    case 'pr-review': {
      const prNumber = task.prReviewUrl?.match(/\/pull\/(\d+)/)?.[1];
      return prNumber ? `reviewing PR #${prNumber}` : 'reviewing PR';
    }
    default:
      return '';
  }
};

const SHORT_KIND_LABELS: Partial<Record<TaskKind, string>> = {
  phase: 'Phase',
  'run-all': 'Phases',
  'commit-suggest': 'Commit',
  'fix-review': 'Fix',
  'pr-review': 'Review',
  'batch-reconcile': 'Reconcile',
  reconcile: 'Reconcile',
  'batch-draft': 'Draft',
  draft: 'Draft',
  extend: 'Extend',
  audit: 'Audit',
  'overlap-check': 'Overlap',
  sync: 'Sync',
  'resolve-conflict': 'Conflict',
  chat: 'Chat',
};

/** `Phases: IDEA-123` — the kind and the entity, not the whole title, so the id
 *  survives at panel width. Falls back to the title when there is no id. */
export const taskCardTitle = (task: AgentTaskState): string => {
  const kind = SHORT_KIND_LABELS[task.taskKind];
  if (!kind) return task.planId ?? task.planTitle;
  const numbered =
    task.taskKind === 'phase' && task.phaseIndex !== undefined
      ? `${kind} ${task.phaseIndex + 1}`
      : kind;
  return task.planId ? `${numbered}: ${task.planId}` : numbered;
};

export const taskPagePath = (task: AgentTaskState): string =>
  task.taskKind === 'chat' ? '/chat' : `/activity/${logRowIdForTask(task)}`;

export const taskSubtitle = (task: AgentTaskState): string => {
  const label = taskKindLabel(task);
  if (!label || label.toLowerCase() === task.planTitle.trim().toLowerCase()) return '';
  return ` — ${label}`;
};

export const closedIdsFromPlans = (entries: PlanEntry[] | undefined): Set<string> =>
  new Set(
    (entries ?? [])
      .filter((plan) => plan.status === 'done' || plan.status === 'dropped')
      .map((plan) => plan.id)
      .filter((id): id is string => id !== undefined),
  );

export const buildScopedNotices = (
  own: { taskLog: TaskLogEntry[]; closedIds: Set<string>; project?: ScopeRow },
  foreign: { taskLog: TaskLogEntry[]; closedIds: Set<string>; project: ScopeRow }[],
  readIds: Set<string>,
): ScopedNotice[] => [
  ...interruptedNotices(own.taskLog, { closedIds: own.closedIds, readIds }).map((entry) => ({
    entry,
    project: own.project,
  })),
  ...foreign.flatMap(({ project, taskLog, closedIds }) =>
    interruptedNotices(taskLog, { closedIds, readIds }).map((entry) => ({ entry, project })),
  ),
];
