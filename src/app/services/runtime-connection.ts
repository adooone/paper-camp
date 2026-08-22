const RUNTIME_URL_PARAM = 'runtime';
const PAIRING_TOKEN_PARAM = 'token';
const RUNTIMES_KEY = 'paper-camp.runtimes';
const ACTIVE_RUNTIME_KEY = 'paper-camp.activeRuntimeUrl';

export interface RuntimeConnection {
  runtimeUrl: string;
  pairingToken: string | null;
  label?: string;
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

// A re-dial (the same runtime announcing again, or a reload) carries no label,
// so a name the user already gave this entry is kept rather than dropped.
function rememberRuntime(storage: Storage | null, connection: RuntimeConnection): void {
  const existing = readRuntimes(storage);
  const previousLabel = existing.find((r) => r.runtimeUrl === connection.runtimeUrl)?.label;
  const runtimes = existing.filter((r) => r.runtimeUrl !== connection.runtimeUrl);
  runtimes.push(previousLabel ? { ...connection, label: previousLabel } : connection);
  storage?.setItem(RUNTIMES_KEY, JSON.stringify(runtimes));
  storage?.setItem(ACTIVE_RUNTIME_KEY, connection.runtimeUrl);
}

// The list every runtime this device has ever dialled.
export function listRuntimes(storage: Storage | null): RuntimeConnection[] {
  return readRuntimes(storage);
}

// An empty label clears back to whatever name the runtime itself announces.
export function renameRuntime(
  runtimeUrl: string,
  label: string,
  storage: Storage | null,
): RuntimeConnection | null {
  const runtimes = readRuntimes(storage);
  const index = runtimes.findIndex((r) => r.runtimeUrl === runtimeUrl);
  if (index === -1) return null;
  const trimmed = label.trim();
  const renamed: RuntimeConnection = {
    ...runtimes[index],
    label: trimmed === '' ? undefined : trimmed,
  };
  runtimes[index] = renamed;
  storage?.setItem(RUNTIMES_KEY, JSON.stringify(runtimes));
  return renamed;
}

// Only forgets the address, never anything git holds — a removed project is
// re-added the same way it was added the first time.
export function removeRuntime(runtimeUrl: string, storage: Storage | null): void {
  const runtimes = readRuntimes(storage).filter((r) => r.runtimeUrl !== runtimeUrl);
  storage?.setItem(RUNTIMES_KEY, JSON.stringify(runtimes));
  if (storage?.getItem(ACTIVE_RUNTIME_KEY) === runtimeUrl) {
    storage.removeItem(ACTIVE_RUNTIME_KEY);
  }
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
