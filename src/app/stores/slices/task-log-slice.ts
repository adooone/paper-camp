import type { TaskLogEntry } from '@/types/index';
import { fetchTaskLog } from '../../services/content';
import type { SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export function createInitialTaskLogState() {
  return {
    taskLog: [] as TaskLogEntry[],
    taskLogLoading: true,
    activeLogEntryTitle: null as string | null,
  };
}

export type TaskLogSlice = {
  taskLog: TaskLogEntry[];
  taskLogLoading: boolean;
  loadTaskLog: () => Promise<void>;

  activeLogEntryTitle: string | null;
  setActiveLogEntryTitle: (title: string | null) => void;
};

export function createTaskLogSlice(set: SetState): TaskLogSlice {
  return {
    ...createInitialTaskLogState(),
    loadTaskLog: loadSlice(
      set,
      fetchTaskLog,
      (data) => ({ taskLog: data.entries }),
      () => ({ taskLog: [] }),
      'taskLogLoading',
    ),

    setActiveLogEntryTitle: (title) => set({ activeLogEntryTitle: title }),
  };
}
