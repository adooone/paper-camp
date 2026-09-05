import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/paper-ui/dist/index.css';
import './styles/utilities.css';
import { RouterProvider } from '@tanstack/react-router';
import { HUB_PATH, router } from './router';
import { apiUrl, setApiBase, setApiPairingToken } from './services/api-base';
import { readGithubConfig } from './services/github/config-store';
import { hasChosenProject } from './services/hub';
import './services/machine-connection';
import { mountPrefix } from './services/mount';
import { runtimeConnection } from './services/runtime-connection';
import { probeSelfServed } from './stores/slices/runtime-slice';

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

async function chooseProject(): Promise<boolean> {
  if (hasChosenProject(mountPrefix, runtimeUrl, readGithubConfig() !== null)) return true;
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
    if (!chosenProject && !router.state.location.pathname.startsWith(HUB_PATH)) {
      router.navigate({ to: HUB_PATH, replace: true });
    }
  });
