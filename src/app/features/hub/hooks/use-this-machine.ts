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
  pendingUpdateVersion: string | null;
  openProject: (slug: string) => void;
}

export function useThisMachine(chosenRuntimeUrls: string[]): UseThisMachineResult {
  const [machineUrl] = useState(() => window.location.origin);
  const [projects, setProjects] = useState<MachineProjectSummary[]>([]);
  const [pendingUpdateVersion, setPendingUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    detectThisMachine(mountPrefix, machineUrl, fetchMachineProjects).then((result) => {
      if (!result) return;
      setProjects(result.projects);
      setPendingUpdateVersion(result.pendingUpdateVersion);
    });
  }, [machineUrl]);

  return {
    projects: pickableMachineProjects(machineUrl, projects, chosenRuntimeUrls),
    pendingUpdateVersion,
    openProject: (slug) => {
      window.location.assign(
        runtimeAdditionUrl(window.location.pathname, machineProjectRuntimeUrl(machineUrl, slug)),
      );
    },
  };
}
