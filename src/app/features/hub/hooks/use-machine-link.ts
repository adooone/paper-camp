import { machineProjectRuntimeUrl, runtimeAdditionUrl } from '@/app/services/hub';
import { machineConnection } from '@/app/services/machine-connection';
import { fetchMachineProjects } from '@/app/services/system';
import type { MachineProjectSummary } from '@/types/index';
import { useEffect, useState } from 'react';

export interface UseMachineLinkResult {
  machineUrl: string;
  projects: MachineProjectSummary[] | null;
  loading: boolean;
  openProject: (slug: string) => void;
}

// null when the visit carried no `?machine=` link — nothing for a caller to render.
export function useMachineLink(): UseMachineLinkResult | null {
  const { machineUrl, pairingToken } = machineConnection;
  const [projects, setProjects] = useState<MachineProjectSummary[] | null>(null);
  const [loading, setLoading] = useState(machineUrl !== '');

  useEffect(() => {
    if (!machineUrl) return;
    fetchMachineProjects(machineUrl)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [machineUrl]);

  if (!machineUrl) return null;

  return {
    machineUrl,
    projects,
    loading,
    openProject: (slug) => {
      window.location.assign(
        runtimeAdditionUrl(
          window.location.pathname,
          machineProjectRuntimeUrl(machineUrl, slug),
          pairingToken,
        ),
      );
    },
  };
}
