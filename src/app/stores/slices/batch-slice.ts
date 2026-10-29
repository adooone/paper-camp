import type { BatchRunRules } from '@/core/batch-run';
import {
  type BatchPreview,
  type BatchStatus,
  controlBatchRun as controlBatchRunApi,
  endBatchRun as endBatchRunApi,
  fetchBatchPreview,
  fetchBatchStatus,
  resumeBatchRun as resumeBatchRunApi,
  startBatchRun as startBatchRunApi,
} from '../../services/batch-api';
import type { GetState, SetState } from './slice-helpers';

export function createInitialBatchState() {
  return {
    batchPreview: null as BatchPreview | null,
    batchStatus: null as BatchStatus | null,
    batchSheetOpen: false,
    // The finished card stays as a report until dismissed; reset whenever a new
    // run starts so the previous run's dismissal doesn't hide the new one.
    batchSummaryDismissed: false,
  };
}

export type BatchSlice = {
  batchPreview: BatchPreview | null;
  loadBatchPreview: () => Promise<void>;
  batchStatus: BatchStatus | null;
  loadBatchStatus: () => Promise<void>;
  startBatch: (ids: string[], rules?: Partial<BatchRunRules>) => Promise<void>;
  controlBatch: (action: 'stop' | 'stop-after-phase' | 'stop-after-idea' | 'skip') => Promise<void>;
  resumeBatch: () => Promise<void>;
  endBatch: () => Promise<void>;
  // One sheet, shared by the toolbar button, the worklist menu entry and the
  // stack-panel card — it switches between the picker and the live view by state.
  batchSheetOpen: boolean;
  openBatchSheet: () => void;
  closeBatchSheet: () => void;
  batchSummaryDismissed: boolean;
  dismissBatchSummary: () => void;
};

export function createBatchSlice(set: SetState, get: GetState): BatchSlice {
  return {
    ...createInitialBatchState(),
    openBatchSheet: () => set({ batchSheetOpen: true }),
    closeBatchSheet: () => set({ batchSheetOpen: false }),
    loadBatchPreview: async () => {
      try {
        const batchPreview = await fetchBatchPreview();
        set({ batchPreview });
      } catch {}
    },
    loadBatchStatus: async () => {
      try {
        const batchStatus = await fetchBatchStatus();
        set({ batchStatus });
      } catch {}
    },
    startBatch: async (ids, rules) => {
      set({ batchSummaryDismissed: false });
      await startBatchRunApi(ids, rules);
      await Promise.all([
        get().loadAgentStatus(),
        get().loadBatchStatus(),
        get().loadBatchPreview(),
      ]);
    },
    controlBatch: async (action) => {
      await controlBatchRunApi(action);
      await get().loadBatchStatus();
    },
    resumeBatch: async () => {
      set({ batchSummaryDismissed: false });
      await resumeBatchRunApi();
      await Promise.all([get().loadAgentStatus(), get().loadBatchStatus()]);
    },
    endBatch: async () => {
      await endBatchRunApi();
      await get().loadBatchStatus();
    },
    dismissBatchSummary: () => set({ batchSummaryDismissed: true }),
  };
}
