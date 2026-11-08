import { projectQueryKey, queryClient } from '@/app/services/query-client';
import { getRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchAgentStatus } from '../services/agent-api';
import { fetchConsistency, fetchDoctor, fetchRepoDocs, fetchTaskLog } from '../services/content';
import { fetchRoadmap } from '../services/content/docs-api';
import { fetchGitStatus } from '../services/git-api';
import { fetchReleaseVersions } from '../services/release-notes-api';
import { fetchStatus } from '../services/status-api';
import type { AppStore } from './app-store';
import type { SetState } from './slices/slice-helpers';

interface Resource<T> {
  fetch: () => Promise<T>;
  apply: (data: T) => Partial<AppStore>;
  fallback?: (error: unknown) => Partial<AppStore>;
  loadingKey?: keyof AppStore;
}

function resource<T>(definition: Resource<T>): Resource<T> {
  return definition;
}

export const PROJECT_RESOURCES = {
  status: resource({ fetch: fetchStatus, apply: (data) => ({ status: data }) }),
  consistency: resource({ fetch: fetchConsistency, apply: (data) => ({ consistency: data }) }),
  doctor: resource({ fetch: fetchDoctor, apply: (data) => ({ doctor: data }) }),
  'git-status': resource({
    fetch: fetchGitStatus,
    apply: ({ branch, entries, ahead, behind, diverged, branchHygiene, stashes }) => ({
      gitStatus: entries,
      gitBranch: branch,
      gitAhead: ahead,
      gitBehind: behind,
      gitDiverged: diverged,
      gitBranchHygiene: branchHygiene,
      gitStashes: stashes,
    }),
  }),
  'agent-status': resource({ fetch: fetchAgentStatus, apply: (data) => ({ agentStatus: data }) }),
  'task-log': resource({
    fetch: fetchTaskLog,
    apply: (data) => ({ taskLog: data.entries, taskLogLoading: false }),
    fallback: () => ({ taskLog: [], taskLogLoading: false }),
    loadingKey: 'taskLogLoading',
  }),
  roadmap: resource({
    fetch: fetchRoadmap,
    apply: (data) => ({ roadmap: data, roadmapError: null, roadmapLoading: false }),
    fallback: (error) => ({ roadmapError: String(error), roadmapLoading: false }),
    loadingKey: 'roadmapLoading',
  }),
  'repo-docs': resource({
    fetch: fetchRepoDocs,
    apply: (data) => ({ repoDocs: data.files, repoDocsLoading: false }),
    fallback: () => ({ repoDocs: [], repoDocsLoading: false }),
    loadingKey: 'repoDocsLoading',
  }),
  'release-versions': resource({
    fetch: fetchReleaseVersions,
    apply: (data) => ({ releaseVersions: data, releaseVersionsLoading: false }),
    fallback: () => ({ releaseVersions: [], releaseVersionsLoading: false }),
    loadingKey: 'releaseVersionsLoading',
  }),
};

export type ProjectResourceName = keyof typeof PROJECT_RESOURCES;

type ResourceData<K extends ProjectResourceName> = Awaited<
  ReturnType<(typeof PROJECT_RESOURCES)[K]['fetch']>
>;

export async function fetchProjectResource<K extends ProjectResourceName>(
  name: K,
): Promise<{ data: ResourceData<K>; current: boolean }> {
  const { runtimeUrl } = getRuntimeConnection();
  const data = await queryClient.fetchQuery({
    queryKey: projectQueryKey(runtimeUrl, name),
    queryFn: PROJECT_RESOURCES[name].fetch as () => Promise<unknown>,
    staleTime: 0,
  });
  return {
    data: data as ResourceData<K>,
    current: getRuntimeConnection().runtimeUrl === runtimeUrl,
  };
}

export async function loadProjectResource(
  set: SetState,
  name: ProjectResourceName,
): Promise<boolean> {
  const { runtimeUrl } = getRuntimeConnection();
  const definition = PROJECT_RESOURCES[name] as Resource<unknown>;
  const cached = queryClient.getQueryData(projectQueryKey(runtimeUrl, name));
  if (definition.loadingKey && cached === undefined) {
    set({ [definition.loadingKey]: true } as Partial<AppStore>);
  }
  try {
    const { data, current } = await fetchProjectResource(name);
    if (!current) return false;
    set(definition.apply(data as never));
    return true;
  } catch (error) {
    if (getRuntimeConnection().runtimeUrl === runtimeUrl) set(definition.fallback?.(error) ?? {});
    return false;
  }
}

export function cachedProjectState(runtimeUrl: string): Partial<AppStore> {
  let restored: Partial<AppStore> = {};
  for (const name of Object.keys(PROJECT_RESOURCES) as ProjectResourceName[]) {
    const data = queryClient.getQueryData(projectQueryKey(runtimeUrl, name));
    if (data === undefined) continue;
    restored = { ...restored, ...(PROJECT_RESOURCES[name] as Resource<unknown>).apply(data) };
  }
  return restored;
}
