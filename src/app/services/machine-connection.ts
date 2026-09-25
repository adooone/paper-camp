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
  if (connection.machineUrl) addMachine(connection.machineUrl, connection.pairingToken);
  return connection;
}

export const machineConnection = loadMachineConnection(
  typeof window === 'undefined' ? null : window.location,
);

/**
 * Where a pasted pairing link lands: its `machine` and `token` carried onto THIS
 * origin, so a link printed for the hosted client pairs whichever build pasted it —
 * a preview deployment, a local build — instead of navigating away to production.
 * Returns null when the text is not a link or carries no machine.
 */
export function rehostPairingLink(text: string, origin: string, prefix: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(text.trim());
  } catch {
    return null;
  }
  const machine = parsed.searchParams.get(MACHINE_URL_PARAM);
  if (!machine) return null;
  const params = new URLSearchParams({ [MACHINE_URL_PARAM]: machine });
  const token = parsed.searchParams.get(PAIRING_TOKEN_PARAM);
  if (token) params.set(PAIRING_TOKEN_PARAM, token);
  return `${origin}${prefix || '/'}?${params}`;
}
