import type { IdeaEntry, ParseResult, PlanEntry } from '@/types/index';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createStore, del, get, set } from 'idb-keyval';
import { useAppStore } from '../stores/app-store';
import { subscribeToActivityStream } from './activity-stream';
import { getRuntimeConnection } from './runtime-connection';
import { CLIENT_VERSION } from './version';

export const PROJECT_QUERY_PREFIX = 'project';

const STALE_TIME_MS = 30_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WRITE_THROTTLE_MS = 1_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      gcTime: MAX_AGE_MS,
    },
  },
});

const idbStore = createStore('paper-camp-query-cache', 'queries');

const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get(key, idbStore),
    setItem: (key, value) => set(key, value, idbStore),
    removeItem: (key) => del(key, idbStore),
  },
  throttleTime: WRITE_THROTTLE_MS,
});

export const persistOptions: PersistQueryClientOptions = {
  queryClient,
  persister,
  maxAge: MAX_AGE_MS,
  buster: CLIENT_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.queryKey[0] === PROJECT_QUERY_PREFIX,
  },
};

export function projectQueryKey(runtimeUrl: string, resource: string) {
  return [PROJECT_QUERY_PREFIX, runtimeUrl, resource] as const;
}

export function plansQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'plans');
}

export function ideasQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'ideas');
}

export function packageNameQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'package-name');
}

export function suggestionsQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'suggestions');
}

export function nightReportQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'night-report');
}

export function capabilitiesQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'capabilities');
}

export function agentAuthStatusQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'agent-auth-status');
}

export function parkedQuestionsQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'parked-questions');
}

export function notificationsQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'notifications');
}

export function chatQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'chat');
}

export function servicesQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'services');
}

export function ciQueryKey(runtimeUrl: string) {
  return projectQueryKey(runtimeUrl, 'ci');
}

export function getCachedPlans(): ParseResult<PlanEntry> | null {
  return (
    queryClient.getQueryData<ParseResult<PlanEntry>>(
      plansQueryKey(getRuntimeConnection().runtimeUrl),
    ) ?? null
  );
}

export function getCachedIdeas(): IdeaEntry[] {
  return (
    queryClient.getQueryData<IdeaEntry[]>(ideasQueryKey(getRuntimeConnection().runtimeUrl)) ?? []
  );
}

export function getPlansError(): string | null {
  const state = queryClient.getQueryState(plansQueryKey(getRuntimeConnection().runtimeUrl));
  return state?.error ? String(state.error) : null;
}

// `refetchType: 'all'` so a refresh triggered while the plans/ideas list isn't
// mounted (e.g. from the Stack panel) still re-fetches, not just marks stale.
export function refreshPlans(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: plansQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshIdeas(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: ideasQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshSuggestions(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: suggestionsQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshNightReport(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: nightReportQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshCapabilities(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: capabilitiesQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshAgentAuthStatus(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: agentAuthStatusQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshParkedQuestions(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: parkedQuestionsQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshNotifications(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: notificationsQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshChat(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: chatQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshServices(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: servicesQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

export function refreshCi(): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: ciQueryKey(getRuntimeConnection().runtimeUrl),
    refetchType: 'all',
  });
}

// The default ('') connection survives a runtime switch on its own (see
// reconnectCurrentRuntime); called once from main.tsx, not at module scope, so importing this module in a test never opens a real EventSource.
export function subscribeProjectToActivityStream(): () => void {
  return subscribeToActivityStream((payload) => {
    if (payload.message !== 'changed') return;
    const { runtimeUrl } = getRuntimeConnection();
    queryClient.invalidateQueries({
      queryKey: [PROJECT_QUERY_PREFIX, runtimeUrl],
      refetchType: 'all',
    });
    useAppStore.getState().refreshProjectState();
  });
}
