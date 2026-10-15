import type { HubProjectRow } from '@/app/services/hub-machines';
import { useAppStore } from '@/app/stores/app-store';
import { lastRouteFor } from './last-route-store';
import { machineToken } from './machine-store';
import { pairWithToken } from './pairing-api';
import { listProjects, projectEntryId } from './project-registry';
import { switchRuntime } from './runtime-connection';

export interface OpenProjectRoute {
  navigate: (opts: { to: string; replace: boolean }) => void;
  routeExists: (pathname: string) => boolean;
}

const storage = typeof window === 'undefined' ? null : window.localStorage;

// A row already in the registry keeps its own pairing token; an unchosen one
// is adopted with the machine's, exactly as a `?runtime=&token=` link would.
function pairingTokenFor(row: HubProjectRow, machineUrl: string): string | null {
  const existing = listProjects(storage).find((entry) => projectEntryId(entry) === row.runtimeUrl);
  return existing ? existing.pairingToken : machineToken(machineUrl);
}

export async function openProject(
  row: HubProjectRow,
  machineUrl: string,
  path: string | undefined,
  route: OpenProjectRoute,
): Promise<void> {
  const pairingToken = pairingTokenFor(row, machineUrl);
  switchRuntime({ runtimeUrl: row.runtimeUrl, pairingToken });
  if (pairingToken) await pairWithToken(pairingToken);

  const store = useAppStore.getState();
  store.resetProjectState();
  store.checkRuntimeReachable();

  const destination = path || lastRouteFor(row.runtimeUrl, storage, route.routeExists) || '/';
  route.navigate({ to: destination, replace: true });
}
