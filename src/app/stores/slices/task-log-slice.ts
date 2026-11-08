import type { TaskLogEntry } from '@/types/index';
import { loadProjectResource } from '../project-resources';
import type { SetState } from './slice-helpers';

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
    loadTaskLog: async () => {
      await loadProjectResource(set, 'task-log');
    },

    setActiveLogEntryTitle: (title) => set({ activeLogEntryTitle: title }),
  };
}
