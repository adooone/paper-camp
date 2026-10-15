import {
  type HubMachine,
  type HubMachineInput,
  type HubProjectRow,
  type RememberedProjectInput,
  buildHubMachines,
  collectMachineUrls,
} from '@/app/services/hub-machines';
import { lastOpenedAt } from '@/app/services/last-route-store';
import { listMachines } from '@/app/services/machine-store';
import { mountPrefix } from '@/app/services/mount';
import { openProject } from '@/app/services/open-project';
import {
  type ProjectEntry,
  listProjects,
  projectEntryId,
  renameProject,
} from '@/app/services/project-registry';
import { fetchMachineProjects } from '@/app/services/system';
import { useNavigate, useRouter } from '@tanstack/react-router';
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
  openRow: (row: HubProjectRow, machineUrl: string, path?: string) => void;
  renameRow: (runtimeUrl: string, label: string) => void;
}

/** Merges this browser's chosen projects with every paired machine's own
 * report into the one grouped list `buildHubMachines` shapes — the origin
 * this page is served from is folded in too, when it's a daemon root
 * (`paper-camp start`) rather than a hosted bundle under a mount prefix. */
export function useHubMachines(): UseHubMachinesResult {
  const navigate = useNavigate();
  const router = useRouter();
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
  const { reports } = useHubMachineReports(machineUrls);

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
    openRow: (row, machineUrl, path) => {
      void openProject(row, machineUrl, path, {
        navigate: (opts) => navigate(opts as never),
        routeExists: (pathname) => router.getMatchedRoutes(pathname).foundRoute !== undefined,
      });
    },
    renameRow: (runtimeUrl, label) => {
      renameProject(runtimeUrl, label, storage);
      setProjects(listProjects(storage));
    },
  };
}
