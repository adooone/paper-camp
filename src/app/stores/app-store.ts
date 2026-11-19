import { create } from 'zustand';
import { cachedProjectState } from './project-resources';
import { type AgentSlice, createAgentSlice, createInitialAgentState } from './slices/agent-slice';
import { type BatchSlice, createBatchSlice, createInitialBatchState } from './slices/batch-slice';
import { createDiffSlice, createInitialDiffState, type DiffSlice } from './slices/diff-slice';
import { createDocsSlice, createInitialDocsState, type DocsSlice } from './slices/docs-slice';
import { createIdeasSlice, type IdeasSlice } from './slices/ideas-slice';
import { createNightReportSlice, type NightReportSlice } from './slices/night-report-slice';
import { createPlansSlice, type PlansSlice } from './slices/plans-slice';
import {
  createInitialRoadmapState,
  createRoadmapSlice,
  type RoadmapSlice,
} from './slices/roadmap-slice';
import { createRuntimeSlice, type RuntimeSlice } from './slices/runtime-slice';
import {
  createInitialStatusState,
  createStatusSlice,
  type StatusSlice,
} from './slices/status-slice';
import { createSuggestionsSlice, type SuggestionsSlice } from './slices/suggestions-slice';
import {
  createInitialTaskLogState,
  createTaskLogSlice,
  type TaskLogSlice,
} from './slices/task-log-slice';

type RestoreSlice = {
  restoreProjectState: (runtimeUrl: string) => void;
};

export type AppStore = PlansSlice &
  RoadmapSlice &
  IdeasSlice &
  SuggestionsSlice &
  NightReportSlice &
  TaskLogSlice &
  DocsSlice &
  StatusSlice &
  AgentSlice &
  BatchSlice &
  DiffSlice &
  RuntimeSlice &
  RestoreSlice;

export const useAppStore = create<AppStore>()((set, get) => ({
  ...createPlansSlice(set),
  ...createRoadmapSlice(set, get),
  ...createIdeasSlice(set, get),
  ...createSuggestionsSlice(set, get),
  ...createNightReportSlice(),
  ...createTaskLogSlice(set),
  ...createDocsSlice(set, get),
  ...createStatusSlice(set, get),
  ...createAgentSlice(set, get),
  ...createBatchSlice(set, get),
  ...createDiffSlice(set, get),
  ...createRuntimeSlice(set),
  restoreProjectState: (runtimeUrl) =>
    set({
      ...createInitialAgentState(),
      ...createInitialBatchState(),
      ...createInitialDiffState(),
      ...createInitialTaskLogState(),
      ...createInitialDocsState(),
      ...createInitialRoadmapState(),
      ...createInitialStatusState(),
      ...cachedProjectState(runtimeUrl),
    }),
}));

export const selectAgentBusy = (s: AppStore) =>
  s.agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

export const selectLatestRateLimit = (s: AppStore) =>
  s.agentStatus.find((t) => t.rateLimit)?.rateLimit ?? null;
