import type { MachineReachState } from '@/app/services/hub-machines';
import { queryClient } from '@/app/services/query-client';
import { fetchMachineProjects, fetchRuntimeVersionAt } from '@/app/services/system';
import type { MachineProjectSummary, MachineProjectsResponse } from '@/types/index';
import { useQueries } from '@tanstack/react-query';
import { useSlowKeys } from './use-slow-keys';

interface MachineReport {
  reach: MachineReachState;
  runtimeVersion: string | null;
  pendingUpdateVersion: string | null;
  reportedProjects: MachineProjectSummary[];
}

const MACHINE_POLL_MS = 5_000;

const LOADING: MachineReport = {
  reach: 'loading',
  runtimeVersion: null,
  pendingUpdateVersion: null,
  reportedProjects: [],
};

export interface UseHubMachineReportsResult {
  reports: Record<string, MachineReport>;
  retry: (machineUrl: string) => void;
}

/** One `/api/machine/projects` query per machine, polled every 5 s and shared by
 * every consumer; a daemon that's down answers nothing and is reported as
 * `unreachable` (shown as offline) rather than the section hanging on it. */
export function useHubMachineReports(machineUrls: string[]): UseHubMachineReportsResult {
  const queries = useQueries({
    queries: machineUrls.flatMap((url) => [
      {
        queryKey: ['hub', 'machine-projects', url],
        queryFn: () => fetchMachineProjects(url),
        refetchInterval: MACHINE_POLL_MS,
        staleTime: MACHINE_POLL_MS,
      },
      {
        queryKey: ['hub', 'machine-version', url],
        queryFn: () => fetchRuntimeVersionAt(url),
        staleTime: Number.POSITIVE_INFINITY,
        refetchInterval: (query: { state: { data: unknown } }) =>
          query.state.data === null ? MACHINE_POLL_MS : false,
      },
    ]),
  });
  const loadingUrls = machineUrls.filter((_url, index) => queries[index * 2]?.isPending);
  const slow = useSlowKeys(loadingUrls);

  const reports: Record<string, MachineReport> = {};
  machineUrls.forEach((url, index) => {
    const projects = queries[index * 2];
    const version = queries[index * 2 + 1];
    if (projects?.isPending) {
      reports[url] = { ...LOADING, reach: slow.has(url) ? 'waiting' : 'loading' };
      return;
    }
    const data = projects?.data as MachineProjectsResponse | null | undefined;
    if (!data) {
      reports[url] = { ...LOADING, reach: 'unreachable' };
      return;
    }
    reports[url] = {
      reach: 'ready',
      runtimeVersion: (version?.data as string | null | undefined) ?? null,
      pendingUpdateVersion: data.pendingUpdateVersion,
      reportedProjects: data.projects,
    };
  });

  return {
    reports,
    retry: (machineUrl) => {
      void queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'hub' && query.queryKey[2] === machineUrl,
      });
    },
  };
}
