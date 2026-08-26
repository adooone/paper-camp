import type { TaskLogEntry } from '@/types/index';

export const HIGHLIGHT_OUTLINE_CLASS = 'outline-[rgba(200,154,90,0.5)]';

export const TASK_OUTCOME_STAMP_FILL: Record<TaskLogEntry['outcome'], string> = {
  done: 'rgba(143, 185, 150, 0.25)',
  superseded: 'rgba(212, 163, 115, 0.25)',
  error: 'rgba(201, 139, 139, 0.25)',
};
