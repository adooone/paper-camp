import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/paper-ui/dist/index.css';
import './styles/utilities.css';
import { RouterProvider } from '@tanstack/react-router';
import { HUB_PATH, router } from './router';
import { apiFetch, apiUrl, setApiBase, setApiPairingToken } from './services/api-base';
import { hasChosenProject, servesOwnRuntime } from './services/hub';
import { mountPrefix } from './services/mount';
import { runtimeConnection } from './services/runtime-connection';

const { runtimeUrl, pairingToken } = runtimeConnection;
setApiBase(runtimeUrl || mountPrefix);
setApiPairingToken(pairingToken);

// A detached, hosted bundle pairs via its `?runtime=&token=` link or a persisted
// token — pair before the first render so the app's own API calls don't 403.
async function pairIfNeeded(): Promise<void> {
  if (!runtimeUrl || !pairingToken) return;
  await fetch(apiUrl('/api/pair'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pairingToken }),
  }).catch(() => {});
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

async function chooseProject(): Promise<boolean> {
  if (hasChosenProject(mountPrefix, runtimeUrl)) return true;
  return servesOwnRuntime(runtimeUrl, (path) => apiFetch(apiUrl(path)));
}

// The router always mounts: rendering the hub outside RouterProvider left its own
// navigation calling router hooks with no router, crashing every hosted load.
pairIfNeeded()
  .then(chooseProject)
  .catch(() => false)
  .then((chosenProject) => {
    if (!chosenProject && !window.location.pathname.startsWith(HUB_PATH)) {
      window.history.replaceState(null, '', `${mountPrefix}${HUB_PATH}`);
    }
    createRoot(rootElement).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
  });
