import type { MachineProjectSummary } from '@/types/index';
import { machineProjectRuntimeUrl, runtimeRowLabel } from './hub';
import { CLIENT_VERSION } from './version';

export type MachineReachState = 'loading' | 'waiting' | 'ready' | 'unreachable';

export type ProjectRowStamp =
  | { kind: 'running'; ideaId: string | null }
  | { kind: 'interrupted'; count: number }
  | { kind: 'missing' }
  | { kind: 'idle' };

export interface ProjectRunState {
  missing: boolean;
  running: boolean;
  /** Which idea a running task is for, when the source knows it — a chosen
   * project's own agent status does, the daemon's coarse `busy` flag doesn't. */
  runningIdeaId: string | null;
  interruptedCount: number;
}

export function projectRowStamp(state: ProjectRunState): ProjectRowStamp {
  if (state.missing) return { kind: 'missing' };
  if (state.running) return { kind: 'running', ideaId: state.runningIdeaId };
  if (state.interruptedCount > 0) return { kind: 'interrupted', count: state.interruptedCount };
  return { kind: 'idle' };
}

export interface HubProjectRow {
  runtimeUrl: string;
  slug: string;
  packageName: string | null;
  label?: string;
  stamp: ProjectRowStamp;
  lastOpenedAt: string | null;
}

export interface HubMachine {
  machineUrl: string;
  host: string;
  reach: MachineReachState;
  runtimeVersion: string | null;
  versionMismatch: boolean;
  pendingUpdateVersion: string | null;
  projects: HubProjectRow[];
  mostRecentActivity: string | null;
}

/** A daemon-served project's runtime URL is `<machineUrl>/p/<slug>` — the
 * inverse of `machineProjectRuntimeUrl`, for sorting a dialled runtime back
 * under the machine that served it. */
export function parseMachineProjectRuntimeUrl(
  runtimeUrl: string,
): { machineUrl: string; slug: string } | null {
  const match = runtimeUrl.match(/^(.*)\/p\/([^/]+)\/?$/);
  return match ? { machineUrl: match[1], slug: match[2] } : null;
}

/** Every machine a daemon report should be fetched for: the ones this browser
 * paired with by link, plus any a chosen project's runtime URL points at even
 * if that pairing was never recorded (a project dialled directly). */
export function collectMachineUrls(
  persistedMachineUrls: string[],
  rememberedRuntimeUrls: string[],
): string[] {
  const parsed = rememberedRuntimeUrls
    .map((url) => parseMachineProjectRuntimeUrl(url)?.machineUrl)
    .filter((url): url is string => url !== undefined);
  return Array.from(new Set([...persistedMachineUrls, ...parsed]));
}

export interface RememberedProjectInput {
  runtimeUrl: string;
  label?: string;
  lastOpenedAt: string | null;
  runState: ProjectRunState;
  /** The live package.json name, when known — null while unreached. */
  packageName: string | null;
  /** The live runtime version, when known — carried onto the solo pseudo-machine
   * built for a project that isn't a `<machineUrl>/p/<slug>` runtime. */
  remoteVersion: string | null;
  /** Used only for a project with no machine of its own — a daemon-served
   * project's reach is the machine's, from `HubMachineInput.reach` instead. */
  reach: MachineReachState;
}

export interface HubMachineInput {
  machineUrl: string;
  reach: MachineReachState;
  runtimeVersion: string | null;
  pendingUpdateVersion: string | null;
  reportedProjects: MachineProjectSummary[];
}

function compareByRecency(a: string | null, b: string | null): number {
  return (b ?? '').localeCompare(a ?? '');
}

/** Running first, then most recently opened — never-opened rows sort last. */
export function compareProjectRows(a: HubProjectRow, b: HubProjectRow): number {
  const aRunning = a.stamp.kind === 'running';
  const bRunning = b.stamp.kind === 'running';
  if (aRunning !== bRunning) return aRunning ? -1 : 1;
  return compareByRecency(a.lastOpenedAt, b.lastOpenedAt);
}

export function machineMostRecentActivity(projects: HubProjectRow[]): string | null {
  return projects.reduce<string | null>((latest, project) => {
    if (!project.lastOpenedAt) return latest;
    if (!latest || project.lastOpenedAt > latest) return project.lastOpenedAt;
    return latest;
  }, null);
}

export function compareMachines(a: HubMachine, b: HubMachine): number {
  return compareByRecency(a.mostRecentActivity, b.mostRecentActivity);
}

/** Merges this browser's chosen projects with each machine's own report into
 * one list, grouped by machine, with each row's stamp and both sort orders
 * applied. `machines` must cover every URL `collectMachineUrls` returns, or a
 * chosen project dialled straight to an unlisted machine has nowhere to land. */
export function buildHubMachines(
  rememberedProjects: RememberedProjectInput[],
  machines: HubMachineInput[],
): HubMachine[] {
  const rememberedByUrl = new Map(
    rememberedProjects.map((project) => [project.runtimeUrl, project]),
  );
  const consumed = new Set<string>();

  const daemonMachines = machines.map((machine): HubMachine => {
    const rows = machine.reportedProjects.map((project): HubProjectRow => {
      const runtimeUrl = machineProjectRuntimeUrl(machine.machineUrl, project.slug);
      const remembered = rememberedByUrl.get(runtimeUrl);
      if (remembered) consumed.add(runtimeUrl);
      const runState: ProjectRunState = remembered?.runState ?? {
        missing: project.missing,
        running: project.busy,
        runningIdeaId: null,
        interruptedCount: project.interruptedCount ?? 0,
      };
      return {
        runtimeUrl,
        slug: project.slug,
        packageName: project.name !== project.slug ? project.name : null,
        label: remembered?.label,
        stamp: projectRowStamp({ ...runState, missing: project.missing || runState.missing }),
        lastOpenedAt: remembered?.lastOpenedAt ?? null,
      };
    });
    rows.sort(compareProjectRows);
    return {
      machineUrl: machine.machineUrl,
      host: runtimeRowLabel(machine.machineUrl),
      reach: machine.reach,
      runtimeVersion: machine.runtimeVersion,
      versionMismatch: machine.runtimeVersion !== null && machine.runtimeVersion !== CLIENT_VERSION,
      pendingUpdateVersion: machine.pendingUpdateVersion,
      projects: rows,
      mostRecentActivity: machineMostRecentActivity(rows),
    };
  });

  const soloMachines = rememberedProjects
    .filter(
      (project) =>
        !consumed.has(project.runtimeUrl) &&
        parseMachineProjectRuntimeUrl(project.runtimeUrl) === null,
    )
    .map((project): HubMachine => {
      const slug = project.label ?? project.packageName ?? runtimeRowLabel(project.runtimeUrl);
      const row: HubProjectRow = {
        runtimeUrl: project.runtimeUrl,
        slug,
        packageName: project.packageName !== slug ? project.packageName : null,
        label: project.label,
        stamp: projectRowStamp(project.runState),
        lastOpenedAt: project.lastOpenedAt,
      };
      return {
        machineUrl: project.runtimeUrl,
        host: runtimeRowLabel(project.runtimeUrl),
        reach: project.reach,
        runtimeVersion: project.remoteVersion,
        versionMismatch: project.remoteVersion !== null && project.remoteVersion !== CLIENT_VERSION,
        pendingUpdateVersion: null,
        projects: [row],
        mostRecentActivity: project.lastOpenedAt,
      };
    });

  return [...daemonMachines, ...soloMachines].sort(compareMachines);
}
