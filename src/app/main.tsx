import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/paper-ui/dist/index.css';
import './styles/utilities.css';
import { RouterProvider } from '@tanstack/react-router';
import { HubShell } from './features/hub';
import { router } from './router';
import { apiUrl, setApiBase } from './services/api-base';
import { hasChosenProject } from './services/hub';
import { mountPrefix } from './services/mount';
import { runtimeConnection } from './services/runtime-connection';

const { runtimeUrl, pairingToken } = runtimeConnection;
setApiBase(runtimeUrl || mountPrefix);
const chosenProject = hasChosenProject(mountPrefix, runtimeUrl);

// A detached, hosted bundle pairs via its `?runtime=&token=` link or a token
// persisted from an earlier one — pair before the first render so the app's
// own API calls aren't the ones that 403.
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

pairIfNeeded().finally(() => {
  createRoot(rootElement).render(
    <StrictMode>{chosenProject ? <RouterProvider router={router} /> : <HubShell />}</StrictMode>,
  );
});
