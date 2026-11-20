import { useMemo } from 'react';
import { useHubMachines } from '@/app/features/hub/hooks/use-hub-machines';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { type ProjectSwitcherItem, switcherItems } from '../shell/project-items';

export interface ProjectSwitcherState {
  items: ProjectSwitcherItem[];
  currentId: string | null;
  singleMachineName: string | null;
  select: (item: ProjectSwitcherItem) => void;
}

export function useProjectSwitcher(): ProjectSwitcherState {
  const { machines, openRow } = useHubMachines();
  const { runtimeUrl } = useRuntimeConnection();
  const items = useMemo(() => switcherItems(machines), [machines]);
  return {
    items,
    currentId: runtimeUrl || null,
    singleMachineName: machines.length === 1 ? machines[0].host : null,
    select: (item) => openRow(item.row, item.machineUrl),
  };
}
