import type { MachineReachState, ProjectRunState } from '@/app/services/hub-machines';
import {
  fetchAgentStatusAt,
  fetchPackageNameAt,
  fetchRuntimeVersionAt,
} from '@/app/services/system';
import type { AgentTaskState, AgentTaskStatus } from '@/types/index';
import { useQueries } from '@tanstack/react-query';
import { useSlowKeys } from './use-slow-keys';

export interface ProjectLiveState {
  reach: MachineReachState;
  packageName: string | null;
  remoteVersion: string | null;
  runState: ProjectRunState;
}

const LOADING: ProjectLiveState = {
  reach: 'loading',
  packageName: null,
  remoteVersion: null,
  runState: { missing: false, running: false, runningIdeaId: null, interruptedCount: 0 },
};

const ACTIVE_TASK_STATUSES: AgentTaskStatus[] = ['starting', 'running', 'stopping'];
const STATUS_POLL_MS = 5_000;

function activeTask(tasks: AgentTaskState[] | null): AgentTaskState | null {
  return tasks?.find((task) => ACTIVE_TASK_STATUSES.includes(task.status)) ?? null;
}

const STATUS_POLL = { refetchInterval: STATUS_POLL_MS, staleTime: STATUS_POLL_MS } as const;

const retryWhileNull = (query: { state: { data: unknown } }) =>
  query.state.data === null ? STATUS_POLL_MS : false;

/** Each chosen project's own runtime: package name and version are asked once
 * (and again only while they came back empty), the agent status is the one
 * request per project that polls. Every `useHubMachines` consumer shares these
 * queries, so the page issues each request once however many mount. */
export function useHubProjectStates(runtimeUrls: string[]): Record<string, ProjectLiveState> {
  const queries = useQueries({
    queries: runtimeUrls.flatMap((url) => [
      {
        queryKey: ['hub', 'package-name', url],
        queryFn: () => fetchPackageNameAt(url),
        staleTime: Number.POSITIVE_INFINITY,
        refetchInterval: retryWhileNull,
      },
      {
        queryKey: ['hub', 'runtime-version', url],
        queryFn: () => fetchRuntimeVersionAt(url),
        staleTime: Number.POSITIVE_INFINITY,
        refetchInterval: retryWhileNull,
      },
      {
        queryKey: ['hub', 'agent-status', url],
        queryFn: () => fetchAgentStatusAt(url),
        ...STATUS_POLL,
      },
    ]),
  });
  const loadingUrls = runtimeUrls.filter((_url, index) => queries[index * 3 + 1]?.isPending);
  const slow = useSlowKeys(loadingUrls);

  const states: Record<string, ProjectLiveState> = {};
  runtimeUrls.forEach((url, index) => {
    const [packageName, version, status] = queries.slice(index * 3, index * 3 + 3);
    if (version?.isPending) {
      states[url] = { ...LOADING, reach: slow.has(url) ? 'waiting' : 'loading' };
      return;
    }
    if (!version || version.data == null) {
      states[url] = { ...LOADING, reach: 'unreachable' };
      return;
    }
    const task = activeTask((status?.data as AgentTaskState[] | null | undefined) ?? null);
    states[url] = {
      reach: 'ready',
      packageName: (packageName?.data as string | null | undefined) ?? null,
      remoteVersion: version.data as string,
      runState: {
        missing: false,
        running: task !== null,
        runningIdeaId: task?.ideaId ?? null,
        interruptedCount: 0,
      },
    };
  });
  return states;
}
