import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@dendelion/folk-ui/dist/index.css';
import './styles/utilities.css';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from '@tanstack/react-router';
import { HUB_PATH, router } from './router';
import { connectRuntime, resolveProject } from './services/boot';
import { lastRouteFor } from './services/last-route-store';
import { machineConnection } from './services/machine-connection';
import { mountPrefix } from './services/mount';
import { persistOptions, queryClient } from './services/query-client';

const storage = typeof window === 'undefined' ? null : window.localStorage;

const runtimeUrl = connectRuntime();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

// The router mounts at once — nothing on the boot path awaits a fetch, so the boot
// indicator in index.html is on screen for one paint, not one round trip.
createRoot(rootElement).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
);

// The verdict lands after mount now, so a hosted bundle with no project is sent to
// the hub from the running app instead of the redirect gating first paint on it.
resolveProject(mountPrefix || '/').then((chosenProject) => {
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
  const remembered = lastRouteFor(runtimeUrl, storage, (path) => {
    const [, , foundRoute] = router.getMatchedRoutes(path);
    return foundRoute !== undefined;
  });
  if (remembered) router.navigate({ to: remembered, replace: true });
});
