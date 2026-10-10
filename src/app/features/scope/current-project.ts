import { runtimeRowLabel } from '@/app/services/hub';
import type { HubMachine, HubProjectRow } from '@/app/services/hub-machines';
import { type ScopeKey, scopeKey } from '@/app/services/scope';

export interface CurrentProject {
  key: ScopeKey;
  machineUrl: string;
  host: string;
  project: HubProjectRow;
}

/** The project this page's mount serves, found among the hub-ordered machines
 * when it's a daemon-registered one, or synthesized as its own solo machine
 * when it's served standalone (`paper-camp dev`, nothing to group it under). */
export function resolveCurrentProject(
  machines: HubMachine[],
  currentRuntimeUrl: string,
  fallbackName: string,
): CurrentProject {
  for (const machine of machines) {
    const project = machine.projects.find((p) => p.runtimeUrl === currentRuntimeUrl);
    if (project) {
      return {
        key: scopeKey(project.slug, machine.host),
        machineUrl: machine.machineUrl,
        host: machine.host,
        project,
      };
    }
  }
  const host = runtimeRowLabel(
    currentRuntimeUrl || (typeof window === 'undefined' ? '' : window.location.origin),
  );
  const project: HubProjectRow = {
    runtimeUrl: currentRuntimeUrl,
    slug: fallbackName,
    packageName: null,
    stamp: { kind: 'idle' },
    lastOpenedAt: null,
  };
  return {
    key: scopeKey(fallbackName, host),
    machineUrl: currentRuntimeUrl || host,
    host,
    project,
  };
}
