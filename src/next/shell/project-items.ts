import type { HubMachine, HubProjectRow, ProjectRowStamp } from '@/app/services/hub-machines';
import type { StampMeaning } from '../ui/stamp';

export interface ProjectSwitcherItem {
  id: string;
  row: HubProjectRow;
  machineUrl: string;
  machineName: string;
  projectName: string;
  stamp: { meaning: StampMeaning; label: string } | null;
}

export const projectName = (packageName: string): string => packageName.replace(/^@[^/]+\//, '');

const rowName = (row: HubProjectRow): string =>
  row.label ?? (row.packageName ? projectName(row.packageName) : row.slug);

const stampOf = (stamp: ProjectRowStamp): ProjectSwitcherItem['stamp'] => {
  switch (stamp.kind) {
    case 'running':
      return { meaning: 'running', label: 'running' };
    case 'interrupted':
      return { meaning: 'failed', label: 'interrupted' };
    case 'missing':
      return { meaning: 'failed', label: 'missing' };
    case 'loading':
      return { meaning: 'parked', label: 'loading' };
    case 'idle':
      return null;
  }
};

export function switcherItems(machines: HubMachine[]): ProjectSwitcherItem[] {
  return machines.flatMap((machine) =>
    machine.projects.map((row) => ({
      id: row.runtimeUrl,
      row,
      machineUrl: machine.machineUrl,
      machineName: machine.host,
      projectName: rowName(row),
      stamp: stampOf(row.stamp),
    })),
  );
}
