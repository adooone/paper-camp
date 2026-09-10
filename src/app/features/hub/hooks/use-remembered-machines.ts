import {
  machineProjectRuntimeUrl,
  pickableMachineProjects,
  runtimeAdditionUrl,
} from '@/app/services/hub';
import { listMachines, machineToken } from '@/app/services/machine-store';
import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useCallback, useEffect, useRef, useState } from 'react';

/** `waiting` is a request still open past the point a healthy one answers —
 * on Chrome that is the local-network permission prompt the page cannot see. */
export type MachineReach = 'loading' | 'waiting' | 'ready' | 'unreachable';

export interface RememberedMachine {
  machineUrl: string;
  reach: MachineReach;
  projects: MachineProjectSummary[];
  pendingUpdateVersion: string | null;
}

export interface UseRememberedMachinesResult {
  machines: RememberedMachine[];
  openProject: (machineUrl: string, slug: string) => void;
  retry: (machineUrl: string) => void;
}

const WAITING_AFTER_MS = 4_000;

export function useRememberedMachines(chosenRuntimeUrls: string[]): UseRememberedMachinesResult {
  const [machineUrls] = useState(listMachines);
  const [reachByMachine, setReachByMachine] = useState<Record<string, MachineReach>>({});
  const [projectsByMachine, setProjectsByMachine] = useState<
    Record<string, MachineProjectSummary[]>
  >({});
  const [pendingUpdateVersionByMachine, setPendingUpdateVersionByMachine] = useState<
    Record<string, string | null>
  >({});
  const mounted = useRef(true);

  const reach = useCallback((machineUrl: string) => {
    setReachByMachine((current) => ({ ...current, [machineUrl]: 'loading' }));
    const slow = setTimeout(() => {
      if (!mounted.current) return;
      setReachByMachine((current) =>
        current[machineUrl] === 'loading' ? { ...current, [machineUrl]: 'waiting' } : current,
      );
    }, WAITING_AFTER_MS);
    fetchMachineProjects(machineUrl).then((result) => {
      clearTimeout(slow);
      if (!mounted.current) return;
      setProjectsByMachine((current) => ({ ...current, [machineUrl]: result?.projects ?? [] }));
      setPendingUpdateVersionByMachine((current) => ({
        ...current,
        [machineUrl]: result?.pendingUpdateVersion ?? null,
      }));
      setReachByMachine((current) => ({
        ...current,
        [machineUrl]: result === null ? 'unreachable' : 'ready',
      }));
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    for (const machineUrl of machineUrls) reach(machineUrl);
    return () => {
      mounted.current = false;
    };
  }, [machineUrls, reach]);

  const machines = machineUrls.map((machineUrl) => ({
    machineUrl,
    reach: reachByMachine[machineUrl] ?? 'loading',
    projects: pickableMachineProjects(
      machineUrl,
      projectsByMachine[machineUrl] ?? [],
      chosenRuntimeUrls,
    ),
    pendingUpdateVersion: pendingUpdateVersionByMachine[machineUrl] ?? null,
  }));

  return {
    machines,
    retry: reach,
    openProject: (machineUrl, slug) => {
      window.location.assign(
        runtimeAdditionUrl(
          window.location.pathname,
          machineProjectRuntimeUrl(machineUrl, slug),
          machineToken(machineUrl),
        ),
      );
    },
  };
}
