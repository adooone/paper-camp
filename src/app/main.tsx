import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/paper-ui/dist/index.css';
import './styles/utilities.css';
import { RouterProvider } from '@tanstack/react-router';
import { HUB_PATH, router } from './router';
import { apiUrl, setApiBase, setApiPairingToken } from './services/api-base';
import {
  hasChosenProject,
  machineProjectRuntimeUrl,
  resolveMachineProjectSlug,
  runtimeAdditionUrl,
} from './services/hub';
import { lastRouteFor } from './services/last-route-store';
import { machineConnection } from './services/machine-connection';
import { mountPrefix } from './services/mount';
import { listProjects, projectEntryId } from './services/project-registry';
import { runtimeConnection } from './services/runtime-connection';
import { fetchMachineProjects } from './services/system';
import { probeSelfServed } from './stores/slices/runtime-slice';

const storage = typeof window === 'undefined' ? null : window.localStorage;

const { runtimeUrl, pairingToken } = runtimeConnection;
setApiBase(runtimeUrl || mountPrefix);
setApiPairingToken(pairingToken);

// A fresh --share tunnel can still be warming up when its link is first opened.
const TUNNEL_WARMUP_TIMEOUT_MS = 15_000;

// A detached, hosted bundle pairs via its `?runtime=&token=` link or a persisted
// token, timed so an unreachable tunnel can't hang the boot sequence forever.
async function pairIfNeeded(): Promise<void> {
  if (!runtimeUrl || !pairingToken) return;
  await fetch(apiUrl('/api/pair'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pairingToken }),
    signal: AbortSignal.timeout(TUNNEL_WARMUP_TIMEOUT_MS),
  }).catch(() => {});
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

// A machine link is a request to see that machine's projects — unless this
// browser already opened one there, or the machine has only one to offer,
// in which case the list is skipped and that project opens directly.
async function chooseMachineProject(machineUrl: string): Promise<boolean> {
  const projects = await fetchMachineProjects(machineUrl);
  if (!projects) return false;
  const chosenRuntimeUrls = listProjects(storage).map(projectEntryId);
  const slug = resolveMachineProjectSlug(machineUrl, projects, chosenRuntimeUrls);
  if (!slug) return false;
  window.location.assign(
    runtimeAdditionUrl(
      mountPrefix || '/',
      machineProjectRuntimeUrl(machineUrl, slug),
      machineConnection.pairingToken,
    ),
  );
  return true;
}

async function chooseProject(): Promise<boolean> {
  if (machineConnection.machineUrl) return chooseMachineProject(machineConnection.machineUrl);
  if (hasChosenProject(mountPrefix, runtimeUrl)) return true;
  return probeSelfServed();
}

// The router mounts at once — nothing on the boot path awaits a fetch, so the boot
// indicator in index.html is on screen for one paint, not one round trip.
createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

// The verdict lands after mount now, so a hosted bundle with no project is sent to
// the hub from the running app instead of the redirect gating first paint on it.
pairIfNeeded()
  .then(chooseProject)
  .catch(() => false)
  .then((chosenProject) => {
    if (!chosenProject) {
      if (!router.state.location.pathname.startsWith(HUB_PATH)) {
        router.navigate({ to: HUB_PATH, replace: true });
      }
      return;
    }
    // A resolved machine link is already reloading into its target project,
    // which is not this runtime, so there is nothing of this browser's to redo here.
    if (machineConnection.machineUrl) return;
    // A bare `/` is an implicit "open the project", not a specific deep link —
    // the only case a remembered route should override where the URL landed.
    if (router.state.location.pathname !== '/') return;
    const remembered = lastRouteFor(
      runtimeUrl,
      storage,
      (path) => router.getMatchedRoutes(path).foundRoute !== undefined,
    );
    if (remembered) router.navigate({ to: remembered, replace: true });
  });
