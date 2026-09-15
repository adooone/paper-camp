import type { MachineReachState } from '@/app/services/hub-machines';
import { fetchMachineProjects, fetchRuntimeVersionAt } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface MachineReport {
  reach: MachineReachState;
  runtimeVersion: string | null;
  pendingUpdateVersion: string | null;
  reportedProjects: MachineProjectSummary[];
}

const LOADING: MachineReport = {
  reach: 'loading',
  runtimeVersion: null,
  pendingUpdateVersion: null,
  reportedProjects: [],
};

/** `waiting` is a request still open past the point a healthy one answers — on
 * Chrome that is the local-network permission prompt the page cannot see. */
const WAITING_AFTER_MS = 4_000;

function fetchOne(machineUrl: string, onReport: (report: MachineReport) => void): void {
  fetchMachineProjects(machineUrl).then((projectsResult) => {
    if (projectsResult === null) {
      onReport({ ...LOADING, reach: 'unreachable' });
      return;
    }
    const report: MachineReport = {
      reach: 'ready',
      runtimeVersion: null,
      pendingUpdateVersion: projectsResult.pendingUpdateVersion,
      reportedProjects: projectsResult.projects,
    };
    onReport(report);
    fetchRuntimeVersionAt(machineUrl).then((runtimeVersion) =>
      onReport({ ...report, runtimeVersion }),
    );
  });
}

export interface UseHubMachineReportsResult {
  reports: Record<string, MachineReport>;
  retry: (machineUrl: string) => void;
}

/** Asks each machine what it's running, once per machine — a daemon that's
 * down or unreachable from this device answers nothing, reported as
 * `unreachable` (shown as offline) rather than the section hanging on it. */
export function useHubMachineReports(machineUrls: string[]): UseHubMachineReportsResult {
  const [reports, setReports] = useState<Record<string, MachineReport>>({});
  const mounted = useRef(true);

  const fetchInto = useCallback((machineUrl: string) => {
    setReports((current) => ({ ...current, [machineUrl]: current[machineUrl] ?? LOADING }));
    const slow = setTimeout(() => {
      if (!mounted.current) return;
      setReports((current) =>
        current[machineUrl]?.reach === 'loading'
          ? { ...current, [machineUrl]: { ...current[machineUrl], reach: 'waiting' } }
          : current,
      );
    }, WAITING_AFTER_MS);
    fetchOne(machineUrl, (result) => {
      clearTimeout(slow);
      if (mounted.current) setReports((current) => ({ ...current, [machineUrl]: result }));
    });
  }, []);

  const urls = machineUrls.join('\n');
  useEffect(() => {
    mounted.current = true;
    for (const machineUrl of urls === '' ? [] : urls.split('\n')) fetchInto(machineUrl);
    return () => {
      mounted.current = false;
    };
  }, [urls, fetchInto]);

  return { reports, retry: fetchInto };
}
