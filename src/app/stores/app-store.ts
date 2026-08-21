import { create } from 'zustand';
import { type AgentSlice, createAgentSlice } from './slices/agent-slice';
import { type DiffSlice, createDiffSlice } from './slices/diff-slice';
import { type DocsSlice, createDocsSlice } from './slices/docs-slice';
import { type GithubSlice, createGithubSlice } from './slices/github-slice';
import { type IdeasSlice, createIdeasSlice } from './slices/ideas-slice';
import { type NotificationsSlice, createNotificationsSlice } from './slices/notifications-slice';
import {
  type ParkedQuestionsSlice,
  createParkedQuestionsSlice,
} from './slices/parked-questions-slice';
import { type PlansSlice, createPlansSlice } from './slices/plans-slice';
import { type RoadmapSlice, createRoadmapSlice } from './slices/roadmap-slice';
import { type RuntimeSlice, createRuntimeSlice } from './slices/runtime-slice';
import { type StatusSlice, createStatusSlice } from './slices/status-slice';
import { type SuggestionsSlice, createSuggestionsSlice } from './slices/suggestions-slice';
import { type TaskLogSlice, createTaskLogSlice } from './slices/task-log-slice';

export type { DetailView } from './slices/plans-slice';

export type AppStore = PlansSlice &
  RoadmapSlice &
  IdeasSlice &
  SuggestionsSlice &
  TaskLogSlice &
  DocsSlice &
  StatusSlice &
  AgentSlice &
  DiffSlice &
  ParkedQuestionsSlice &
  NotificationsSlice &
  RuntimeSlice &
  GithubSlice;

export const useAppStore = create<AppStore>()((set, get) => ({
  ...createPlansSlice(set, get),
  ...createRoadmapSlice(set, get),
  ...createIdeasSlice(set, get),
  ...createSuggestionsSlice(set, get),
  ...createTaskLogSlice(set),
  ...createDocsSlice(set, get),
  ...createStatusSlice(set, get),
  ...createAgentSlice(set, get),
  ...createDiffSlice(set, get),
  ...createParkedQuestionsSlice(set),
  ...createNotificationsSlice(set, get),
  ...createRuntimeSlice(set),
  ...createGithubSlice(set),
}));

export const selectAgentBusy = (s: AppStore) =>
  s.agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

// Capabilities haven't loaded yet: don't block launches on an unknown state.
export const selectHasAnyAgent = (s: AppStore) =>
  s.capabilities.length === 0 ||
  s.capabilities.some((c) => c.id.startsWith('agent:') && c.status === 'ok');

export const selectGhOk = (s: AppStore) => {
  const gh = s.capabilities.find((c) => c.id === 'gh');
  return gh === undefined || gh.status === 'ok';
};

export const selectCapabilityGapCount = (s: AppStore) =>
  s.capabilities.filter((c) => c.status !== 'ok').length;

// loggedIn: null means unknown (non claude-code agent, or the probe couldn't tell) — only
// an explicit false should surface as "not signed in".
export const selectAgentNotSignedIn = (s: AppStore) => s.agentAuthStatus?.loggedIn === false;

export const selectLatestRateLimit = (s: AppStore) =>
  s.agentStatus.find((t) => t.rateLimit)?.rateLimit ?? null;
