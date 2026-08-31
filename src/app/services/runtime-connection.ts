import {
  type ProjectEntry,
  type RuntimeProjectEntry,
  activeProjectId,
  listProjects,
  removeProject,
  renameProject,
  selectProject,
  upsertRuntimeProject,
} from './project-registry';

const RUNTIME_URL_PARAM = 'runtime';
const PAIRING_TOKEN_PARAM = 'token';

export interface RuntimeConnection {
  runtimeUrl: string;
  pairingToken: string | null;
  label?: string;
}

function isRuntimeEntry(entry: ProjectEntry): entry is RuntimeProjectEntry {
  return entry.kind === 'runtime';
}

function toRuntimeConnection(entry: RuntimeProjectEntry): RuntimeConnection {
  return { runtimeUrl: entry.runtimeUrl, pairingToken: entry.pairingToken, label: entry.label };
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

// The list every runtime this device has ever dialled.
export function listRuntimes(storage: Storage | null): RuntimeConnection[] {
  return listProjects(storage).filter(isRuntimeEntry).map(toRuntimeConnection);
}

export function renameRuntime(
  runtimeUrl: string,
  label: string,
  storage: Storage | null,
): RuntimeConnection | null {
  const renamed = renameProject(runtimeUrl, label, storage);
  return renamed && isRuntimeEntry(renamed) ? toRuntimeConnection(renamed) : null;
}

export function removeRuntime(runtimeUrl: string, storage: Storage | null): void {
  removeProject(runtimeUrl, storage);
}

// Switches which already-known runtime is active. Takes effect on the next
// load, same as a fresh `?runtime=&token=` link — there is no live re-dial.
export function selectRuntime(
  runtimeUrl: string,
  storage: Storage | null,
): RuntimeConnection | null {
  const selected = selectProject(runtimeUrl, storage);
  return selected && isRuntimeEntry(selected) ? toRuntimeConnection(selected) : null;
}

function rememberRuntime(storage: Storage | null, connection: RuntimeConnection): void {
  upsertRuntimeProject(connection, storage);
  selectProject(connection.runtimeUrl, storage);
}

/**
 * A pasted `?runtime=&token=` link only carries the connection on the visit
 * that used it; storing it is what makes a later reload with no query
 * string still dial the same runtime, and remembering rather than
 * overwriting is what lets the device hold more than one.
 */
export function loadRuntimeConnection(
  location: { search: string } | null,
  storage: Storage | null,
): RuntimeConnection {
  const fromQuery = readRuntimeConnection(location);
  if (fromQuery.runtimeUrl) {
    rememberRuntime(storage, fromQuery);
    return fromQuery;
  }
  const activeId = activeProjectId(storage);
  const active = activeId
    ? listProjects(storage).find((entry) => isRuntimeEntry(entry) && entry.runtimeUrl === activeId)
    : null;
  return active && isRuntimeEntry(active)
    ? toRuntimeConnection(active)
    : { runtimeUrl: '', pairingToken: null };
}

export const runtimeConnection = loadRuntimeConnection(
  typeof window === 'undefined' ? null : window.location,
  typeof window === 'undefined' ? null : window.localStorage,
);
