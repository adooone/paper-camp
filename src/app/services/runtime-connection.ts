import { useSyncExternalStore } from 'react';
import { reconnectCurrentRuntime } from './activity-stream';
import { setApiBase, setApiPairingToken } from './api-base';
import { mountPrefix } from './mount';
import {
  type ProjectEntry,
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

function toRuntimeConnection(entry: ProjectEntry): RuntimeConnection {
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
  return listProjects(storage).map(toRuntimeConnection);
}

export function renameRuntime(
  runtimeUrl: string,
  label: string,
  storage: Storage | null,
): RuntimeConnection | null {
  const renamed = renameProject(runtimeUrl, label, storage);
  return renamed ? toRuntimeConnection(renamed) : null;
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
  return selected ? toRuntimeConnection(selected) : null;
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
    ? listProjects(storage).find((entry) => entry.runtimeUrl === activeId)
    : null;
  return active ? toRuntimeConnection(active) : { runtimeUrl: '', pairingToken: null };
}

const storage = typeof window === 'undefined' ? null : window.localStorage;

let current: RuntimeConnection = loadRuntimeConnection(
  typeof window === 'undefined' ? null : window.location,
  storage,
);

const listeners = new Set<() => void>();

export function getRuntimeConnection(): RuntimeConnection {
  return current;
}

function subscribeRuntimeConnection(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRuntimeConnection(): RuntimeConnection {
  return useSyncExternalStore(
    subscribeRuntimeConnection,
    getRuntimeConnection,
    getRuntimeConnection,
  );
}

// Switches which project this running app talks to, without a reload: the
// registry remembers the choice, api-base is repointed so every request after
// this call lands on the new runtime, and subscribers re-render against it.
export function switchRuntime(connection: RuntimeConnection): void {
  rememberRuntime(storage, connection);
  setApiBase(connection.runtimeUrl || mountPrefix);
  setApiPairingToken(connection.pairingToken);
  current = connection;
  reconnectCurrentRuntime();
  for (const listener of listeners) listener();
}
