import { setApiBase, setApiPairingToken } from '@/app/services/api-base';
import {
  hasChosenProject,
  machineProjectRuntimeUrl,
  resolveMachineProjectSlug,
  runtimeAdditionUrl,
} from '@/app/services/hub';
import { machineConnection } from '@/app/services/machine-connection';
import { mountPrefix } from '@/app/services/mount';
import { pairWithToken } from '@/app/services/pairing-api';
import { listProjects, projectEntryId } from '@/app/services/project-registry';
import { subscribeProjectToActivityStream } from '@/app/services/query-client';
import { getRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchMachineProjects } from '@/app/services/system';
import { useAppStore } from '@/app/stores/app-store';
import { probeSelfServed } from '@/app/stores/slices/runtime-slice';

const storage = typeof window === 'undefined' ? null : window.localStorage;

export function connectRuntime(): string {
  const { runtimeUrl, pairingToken } = getRuntimeConnection();
  setApiBase(runtimeUrl || mountPrefix);
  setApiPairingToken(pairingToken);
  subscribeProjectToActivityStream(() => useAppStore.getState().refreshProjectState());
  return runtimeUrl;
}

// A detached, hosted bundle pairs via its `?runtime=&token=` link or a persisted token.
async function pairIfNeeded(): Promise<void> {
  const { runtimeUrl, pairingToken } = getRuntimeConnection();
  if (!runtimeUrl || !pairingToken) return;
  await pairWithToken(pairingToken);
}

// A machine link opens that machine's project list — unless this browser
// already opened one there, or the machine has only one, then it opens directly.
async function chooseMachineProject(machineUrl: string, appPath: string): Promise<boolean> {
  const result = await fetchMachineProjects(machineUrl);
  if (!result) return false;
  const chosenRuntimeUrls = listProjects(storage).map(projectEntryId);
  const slug = resolveMachineProjectSlug(machineUrl, result.projects, chosenRuntimeUrls);
  if (!slug) return false;
  window.location.assign(
    runtimeAdditionUrl(
      appPath,
      machineProjectRuntimeUrl(machineUrl, slug),
      machineConnection.pairingToken,
    ),
  );
  return true;
}

async function chooseProject(appPath: string): Promise<boolean> {
  if (machineConnection.machineUrl)
    return chooseMachineProject(machineConnection.machineUrl, appPath);
  if (hasChosenProject(mountPrefix, getRuntimeConnection().runtimeUrl)) return true;
  return probeSelfServed();
}

export function resolveProject(appPath: string): Promise<boolean> {
  return pairIfNeeded()
    .then(() => chooseProject(appPath))
    .catch(() => false);
}
