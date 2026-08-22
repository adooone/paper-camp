const RUNTIME_URL_PARAM = 'runtime';
const PAIRING_TOKEN_PARAM = 'token';
const RUNTIMES_KEY = 'paper-camp.runtimes';
const ACTIVE_RUNTIME_KEY = 'paper-camp.activeRuntimeUrl';

export interface RuntimeConnection {
  runtimeUrl: string;
  pairingToken: string | null;
}

// Absent when `paper-camp dev` serves this same bundle locally — a bare page
// load carries neither param, so apiUrl stays relative and no pairing is needed.
export function readRuntimeConnection(location: { search: string } | null): RuntimeConnection {
  const params = new URLSearchParams(location?.search ?? '');
  return {
    runtimeUrl: params.get(RUNTIME_URL_PARAM) ?? '',
    pairingToken: params.get(PAIRING_TOKEN_PARAM),
  };
}

function readRuntimes(storage: Storage | null): RuntimeConnection[] {
  const raw = storage?.getItem(RUNTIMES_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as RuntimeConnection[]) : [];
}

function rememberRuntime(storage: Storage | null, connection: RuntimeConnection): void {
  const runtimes = readRuntimes(storage).filter((r) => r.runtimeUrl !== connection.runtimeUrl);
  runtimes.push(connection);
  storage?.setItem(RUNTIMES_KEY, JSON.stringify(runtimes));
  storage?.setItem(ACTIVE_RUNTIME_KEY, connection.runtimeUrl);
}

// The list every runtime this device has ever dialled — IDEA-117 registers,
// renames and removes entries in it; this phase only grows and reads it.
export function listRuntimes(storage: Storage | null): RuntimeConnection[] {
  return readRuntimes(storage);
}

// Switches which already-known runtime is active. Takes effect on the next
// load, same as a fresh `?runtime=&token=` link — there is no live re-dial.
export function selectRuntime(
  runtimeUrl: string,
  storage: Storage | null,
): RuntimeConnection | null {
  const match = readRuntimes(storage).find((r) => r.runtimeUrl === runtimeUrl);
  if (!match) return null;
  storage?.setItem(ACTIVE_RUNTIME_KEY, match.runtimeUrl);
  return match;
}

// Leaving a project drops which runtime is active, not the runtimes list
// itself — the registry survives so the shell's projects list still has
// every entry to choose from again.
export function leaveActiveRuntime(storage: Storage | null): void {
  storage?.removeItem(ACTIVE_RUNTIME_KEY);
}

// A pasted `?runtime=&token=` link only carries the connection on the visit
// that used it; storing it is what makes a later reload with no query string
// still dial the same runtime, and remembering rather than overwriting is
// what lets the device hold more than one.
export function loadRuntimeConnection(
  location: { search: string } | null,
  storage: Storage | null,
): RuntimeConnection {
  const fromQuery = readRuntimeConnection(location);
  if (fromQuery.runtimeUrl) {
    rememberRuntime(storage, fromQuery);
    return fromQuery;
  }
  const activeUrl = storage?.getItem(ACTIVE_RUNTIME_KEY);
  const active = activeUrl ? readRuntimes(storage).find((r) => r.runtimeUrl === activeUrl) : null;
  return active ?? { runtimeUrl: '', pairingToken: null };
}

export const runtimeConnection = loadRuntimeConnection(
  typeof window === 'undefined' ? null : window.location,
  typeof window === 'undefined' ? null : window.localStorage,
);
