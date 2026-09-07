import {
  detectThisMachine,
  machineProjectRuntimeUrl,
  pickableMachineProjects,
  runtimeAdditionUrl,
} from '@/app/services/hub';
import { mountPrefix } from '@/app/services/mount';
import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useEffect, useState } from 'react';

export interface UseThisMachineResult {
  projects: MachineProjectSummary[];
  openProject: (slug: string) => void;
}

export function useThisMachine(chosenRuntimeUrls: string[]): UseThisMachineResult {
  const [machineUrl] = useState(() => window.location.origin);
  const [projects, setProjects] = useState<MachineProjectSummary[]>([]);

  useEffect(() => {
    detectThisMachine(mountPrefix, machineUrl, fetchMachineProjects).then((result) => {
      if (result) setProjects(result);
    });
  }, [machineUrl]);

  return {
    projects: pickableMachineProjects(machineUrl, projects, chosenRuntimeUrls),
    openProject: (slug) => {
      window.location.assign(
        runtimeAdditionUrl(window.location.pathname, machineProjectRuntimeUrl(machineUrl, slug)),
      );
    },
  };
}
