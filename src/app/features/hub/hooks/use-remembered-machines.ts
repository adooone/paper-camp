import {
  machineProjectRuntimeUrl,
  pickableMachineProjects,
  runtimeAdditionUrl,
} from '@/app/services/hub';
import { machineConnection } from '@/app/services/machine-connection';
import { listMachines } from '@/app/services/machine-store';
import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useCallback, useEffect, useState } from 'react';

/** `waiting` is a request still open past the point a healthy one answers —
 * on Chrome that is the local-network permission prompt the page cannot see. */
export type MachineReach = 'loading' | 'waiting' | 'ready' | 'unreachable';

export interface RememberedMachine {
  machineUrl: string;
  reach: MachineReach;
  projects: MachineProjectSummary[];
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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;
    for (const machineUrl of machineUrls) {
      setReachByMachine((current) => ({ ...current, [machineUrl]: 'loading' }));
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setReachByMachine((current) =>
            current[machineUrl] === 'loading' ? { ...current, [machineUrl]: 'waiting' } : current,
          );
        }, WAITING_AFTER_MS),
      );
      fetchMachineProjects(machineUrl).then((projects) => {
        if (cancelled) return;
        setProjectsByMachine((current) => ({ ...current, [machineUrl]: projects ?? [] }));
        setReachByMachine((current) => ({
          ...current,
          [machineUrl]: projects === null ? 'unreachable' : 'ready',
        }));
      });
    }
    return () => {
      cancelled = true;
      for (const timer of timers) clearTimeout(timer);
    };
  }, [machineUrls, attempt]);

  const machines = machineUrls.map((machineUrl) => ({
    machineUrl,
    reach: reachByMachine[machineUrl] ?? 'loading',
    projects: pickableMachineProjects(
      machineUrl,
      projectsByMachine[machineUrl] ?? [],
      chosenRuntimeUrls,
    ),
  }));

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    machines,
    retry,
    openProject: (machineUrl, slug) => {
      const token =
        machineConnection.machineUrl === machineUrl ? machineConnection.pairingToken : null;
      window.location.assign(
        runtimeAdditionUrl(
          window.location.pathname,
          machineProjectRuntimeUrl(machineUrl, slug),
          token,
        ),
      );
    },
  };
}
