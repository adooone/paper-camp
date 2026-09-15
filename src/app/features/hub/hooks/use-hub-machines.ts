import { runtimeAdditionUrl } from '@/app/services/hub';
import {
  type HubMachine,
  type HubMachineInput,
  type HubProjectRow,
  type RememberedProjectInput,
  buildHubMachines,
  collectMachineUrls,
} from '@/app/services/hub-machines';
import { lastOpenedAt } from '@/app/services/last-route-store';
import { listMachines, machineToken } from '@/app/services/machine-store';
import { mountPrefix } from '@/app/services/mount';
import {
  type ProjectEntry,
  listProjects,
  projectEntryId,
  removeProject,
  renameProject,
  selectProject,
} from '@/app/services/project-registry';
import { fetchMachineProjects } from '@/app/services/system';
import { useEffect, useMemo, useState } from 'react';
import { useHubMachineReports } from './use-hub-machine-reports';
import { useHubProjectStates } from './use-hub-project-states';

const storage = typeof window === 'undefined' ? null : window.localStorage;

const NO_RUN_STATE = {
  missing: false,
  running: false,
  runningIdeaId: null,
  interruptedCount: 0,
} as const;

export interface UseHubMachinesResult {
  machines: HubMachine[];
  chosenRuntimeUrls: Set<string>;
  openRow: (row: HubProjectRow, machineUrl: string) => void;
  renameRow: (runtimeUrl: string, label: string) => void;
  forgetRow: (runtimeUrl: string) => void;
  retryMachine: (machineUrl: string) => void;
}

/** Merges this browser's chosen projects with every paired machine's own
 * report into the one grouped list `buildHubMachines` shapes — the origin
 * this page is served from is folded in too, when it's a daemon root
 * (`paper-camp start`) rather than a hosted bundle under a mount prefix. */
export function useHubMachines(): UseHubMachinesResult {
  const [projects, setProjects] = useState<ProjectEntry[]>(() => listProjects(storage));
  const chosenRuntimeUrls = useMemo(() => projects.map(projectEntryId), [projects]);

  const [machineUrls, setMachineUrls] = useState<string[]>(() =>
    collectMachineUrls(listMachines(), chosenRuntimeUrls),
  );

  useEffect(() => {
    if (mountPrefix !== '') return;
    const origin = window.location.origin;
    fetchMachineProjects(origin).then((result) => {
      if (!result) return;
      setMachineUrls((current) => (current.includes(origin) ? current : [...current, origin]));
    });
  }, []);

  const projectStates = useHubProjectStates(chosenRuntimeUrls);
  const { reports, retry } = useHubMachineReports(machineUrls);

  const rememberedInputs: RememberedProjectInput[] = projects.map((entry) => {
    const url = projectEntryId(entry);
    const live = projectStates[url];
    return {
      runtimeUrl: url,
      label: entry.label,
      lastOpenedAt: lastOpenedAt(url, storage),
      runState: live?.runState ?? NO_RUN_STATE,
      packageName: live?.packageName ?? null,
      remoteVersion: live?.remoteVersion ?? null,
      reach: live?.reach ?? 'loading',
    };
  });

  const machineInputs: HubMachineInput[] = machineUrls.map((machineUrl) => {
    const report = reports[machineUrl];
    return {
      machineUrl,
      reach: report?.reach ?? 'loading',
      runtimeVersion: report?.runtimeVersion ?? null,
      pendingUpdateVersion: report?.pendingUpdateVersion ?? null,
      reportedProjects: report?.reportedProjects ?? [],
    };
  });

  const machines = buildHubMachines(rememberedInputs, machineInputs);
  const chosenSet = new Set(chosenRuntimeUrls);

  return {
    machines,
    chosenRuntimeUrls: chosenSet,
    openRow: (row, machineUrl) => {
      if (chosenSet.has(row.runtimeUrl)) {
        selectProject(row.runtimeUrl, storage);
        window.location.assign(mountPrefix || '/');
        return;
      }
      // Land on the project's own root, not on the hub path this click came from —
      // adopting the runtime there leaves the reload sitting on the hub again.
      window.location.assign(
        runtimeAdditionUrl(mountPrefix || '/', row.runtimeUrl, machineToken(machineUrl)),
      );
    },
    renameRow: (runtimeUrl, label) => {
      renameProject(runtimeUrl, label, storage);
      setProjects(listProjects(storage));
    },
    forgetRow: (runtimeUrl) => {
      removeProject(runtimeUrl, storage);
      setProjects(listProjects(storage));
    },
    retryMachine: retry,
  };
}
