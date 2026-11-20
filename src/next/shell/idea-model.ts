import type { AgentTaskState, PlanStatus, TaskKind, ThreadMessage } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';
import { STATUS_MEANING } from './ideas-model';

export const ALLOWED_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
  idea: ['planned', 'dropped'],
  planned: ['in-progress', 'dropped'],
  'in-progress': ['review', 'dropped'],
  review: ['in-progress', 'done', 'dropped'],
  done: [],
  dropped: [],
};

export const ideaStatusMeaning = (status: PlanStatus): StampMeaning =>
  status === 'review' ? 'idle' : STATUS_MEANING[status];

const TASK_DOING: Partial<Record<TaskKind, string>> = {
  draft: 'Drafting the plan',
  extend: 'Extending the idea',
  feedback: 'Scout is replying',
  'run-all': 'Starting the walk',
};

export const taskDoing = (kind: TaskKind | undefined): string =>
  (kind && TASK_DOING[kind]) ?? 'Working';

export const TAIL_LINES = 4;

export const tailOf = (task: AgentTaskState | null): string[] =>
  (task?.lines ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-TAIL_LINES);

export const formatProgress = (done: number, total: number): string =>
  total === 0 ? '—' : `${done} / ${total}  (${((done / total) * 100).toFixed(0)}%)`;

const PREVIEW_LENGTH = 200;

export const bodyPreview = (body: string, expanded: boolean): string => {
  const text = body.trim();
  return expanded || text.length <= PREVIEW_LENGTH ? text : `${text.slice(0, PREVIEW_LENGTH)}…`;
};

export const threadStampLine = (message: ThreadMessage): string =>
  [
    message.date,
    message.from === 'agent' ? 'agent' : 'you',
    message.kind !== 'chat' ? message.kind : null,
    message.state === 'open' ? 'open' : null,
  ]
    .filter(Boolean)
    .join(' · ');

export const runLabel = (
  walk: { index: number } | null,
  total: number,
  running: AgentTaskState | null,
): string => {
  if (walk) return `Running ${walk.index + 1} of ${total}…`;
  if (running?.phaseIndex != null) return `Running phase ${running.phaseIndex + 1}…`;
  return `${taskDoing(running?.taskKind)}…`;
};
