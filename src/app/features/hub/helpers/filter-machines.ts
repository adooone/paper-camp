import type { HubMachine } from '@/app/services/hub-machines';

export const SEARCH_ROW_THRESHOLD = 8;

export function totalProjectCount(machines: HubMachine[]): number {
  return machines.reduce((sum, machine) => sum + machine.projects.length, 0);
}

export function filterHubMachines(machines: HubMachine[], query: string): HubMachine[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return machines;
  return machines
    .map((machine) => ({
      ...machine,
      projects: machine.projects.filter(
        (project) =>
          project.slug.toLowerCase().includes(needle) ||
          (project.packageName?.toLowerCase().includes(needle) ?? false),
      ),
    }))
    .filter((machine) => machine.projects.length > 0);
}
