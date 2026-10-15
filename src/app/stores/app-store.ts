import { create } from 'zustand';
import { type AgentSlice, createAgentSlice } from './slices/agent-slice';
import { type CapacitySlice, createCapacitySlice } from './slices/capacity-slice';
import { type DiffSlice, createDiffSlice } from './slices/diff-slice';
import { type DocsSlice, createDocsSlice } from './slices/docs-slice';
import { type IdeasSlice, createIdeasSlice } from './slices/ideas-slice';
import { type NightReportSlice, createNightReportSlice } from './slices/night-report-slice';
import { type PlansSlice, createPlansSlice } from './slices/plans-slice';
import { type RoadmapSlice, createRoadmapSlice } from './slices/roadmap-slice';
import { type RuntimeSlice, createRuntimeSlice } from './slices/runtime-slice';
import { type StatusSlice, createStatusSlice } from './slices/status-slice';
import { type SuggestionsSlice, createSuggestionsSlice } from './slices/suggestions-slice';
import { type TaskLogSlice, createTaskLogSlice } from './slices/task-log-slice';

export type { DetailView } from './slices/plans-slice';

export type AppStore = CapacitySlice &
  PlansSlice &
  RoadmapSlice &
  IdeasSlice &
  SuggestionsSlice &
  NightReportSlice &
  TaskLogSlice &
  DocsSlice &
  StatusSlice &
  AgentSlice &
  DiffSlice &
  RuntimeSlice;

export const useAppStore = create<AppStore>()((set, get) => ({
  ...createCapacitySlice(set),
  ...createPlansSlice(set),
  ...createRoadmapSlice(set, get),
  ...createIdeasSlice(set, get),
  ...createSuggestionsSlice(set, get),
  ...createNightReportSlice(),
  ...createTaskLogSlice(set),
  ...createDocsSlice(set, get),
  ...createStatusSlice(set, get),
  ...createAgentSlice(set, get),
  ...createDiffSlice(set, get),
  ...createRuntimeSlice(set),
}));

export const selectAgentBusy = (s: AppStore) =>
  s.agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

export const selectLatestRateLimit = (s: AppStore) =>
  s.agentStatus.find((t) => t.rateLimit)?.rateLimit ?? null;
