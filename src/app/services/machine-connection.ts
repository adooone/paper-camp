import { addMachine } from './machine-store';

const MACHINE_URL_PARAM = 'machine';
const PAIRING_TOKEN_PARAM = 'token';

export interface MachineConnection {
  machineUrl: string;
  pairingToken: string | null;
}

// Absent whenever the visit carries no `?machine=` link — the daemon's own,
// distinct from `?runtime=` so this hub never mistakes the daemon root for a project.
export function readMachineConnection(location: { search: string } | null): MachineConnection {
  const params = new URLSearchParams(location?.search ?? '');
  return {
    machineUrl: params.get(MACHINE_URL_PARAM) ?? '',
    pairingToken: params.get(PAIRING_TOKEN_PARAM),
  };
}

/**
 * A `?machine=&token=` visit is remembered immediately, before `main.tsx`
 * rewrites the URL to the bare hub path — `machine-store.ts` is what still
 * knows about it once that happens.
 */
export function loadMachineConnection(location: { search: string } | null): MachineConnection {
  const connection = readMachineConnection(location);
  if (connection.machineUrl) addMachine(connection.machineUrl);
  return connection;
}

export const machineConnection = loadMachineConnection(
  typeof window === 'undefined' ? null : window.location,
);
