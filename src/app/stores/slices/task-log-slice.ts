import type { TaskLogEntry } from '@/types/index';
import { fetchTaskLog } from '../../services/content';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type TaskLogSlice = {
  taskLog: TaskLogEntry[];
  taskLogLoading: boolean;
  loadTaskLog: () => Promise<void>;
};

export function createTaskLogSlice(set: SetState): TaskLogSlice {
  return {
    taskLog: [],
    taskLogLoading: true,
    loadTaskLog: loadSlice(
      set,
      fetchTaskLog,
      (data) => ({ taskLog: data.entries }),
      () => ({ taskLog: [] }),
      'taskLogLoading',
    ),
  };
}
