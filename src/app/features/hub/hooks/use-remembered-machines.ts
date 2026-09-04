import {
  machineProjectRuntimeUrl,
  pickableMachineProjects,
  runtimeAdditionUrl,
} from '@/app/services/hub';
import { machineConnection } from '@/app/services/machine-connection';
import { listMachines } from '@/app/services/machine-store';
import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useEffect, useState } from 'react';

export interface RememberedMachine {
  machineUrl: string;
  projects: MachineProjectSummary[];
}

export interface UseRememberedMachinesResult {
  machines: RememberedMachine[];
  openProject: (machineUrl: string, slug: string) => void;
}

export function useRememberedMachines(chosenRuntimeUrls: string[]): UseRememberedMachinesResult {
  const [machineUrls] = useState(listMachines);
  const [projectsByMachine, setProjectsByMachine] = useState<
    Record<string, MachineProjectSummary[]>
  >({});

  useEffect(() => {
    for (const machineUrl of machineUrls) {
      fetchMachineProjects(machineUrl).then((projects) => {
        setProjectsByMachine((current) => ({ ...current, [machineUrl]: projects ?? [] }));
      });
    }
  }, [machineUrls]);

  const machines = machineUrls
    .map((machineUrl) => ({
      machineUrl,
      projects: pickableMachineProjects(
        machineUrl,
        projectsByMachine[machineUrl] ?? [],
        chosenRuntimeUrls,
      ),
    }))
    .filter((machine) => machine.projects.length > 0);

  return {
    machines,
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
