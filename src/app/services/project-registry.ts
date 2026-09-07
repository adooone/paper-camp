const PROJECTS_KEY = 'paper-camp.projects';
const ACTIVE_PROJECT_KEY = 'paper-camp.activeProjectId';

// Pre-unification keys — read once to carry an existing device's paired
// runtimes into the unified store instead of losing them.
const LEGACY_RUNTIMES_KEY = 'paper-camp.runtimes';
const LEGACY_ACTIVE_RUNTIME_KEY = 'paper-camp.activeRuntimeUrl';

export interface ProjectEntry {
  runtimeUrl: string;
  pairingToken: string | null;
  label?: string;
}

export function projectEntryId(entry: ProjectEntry): string {
  return entry.runtimeUrl;
}

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

// A pre-unification entry, or one written by an older client, may carry a
// GitHub-kind shape with no `runtimeUrl` — nothing can open that any more,
// so it's dropped here rather than migrated into anything else.
function isProjectEntry(value: unknown): value is ProjectEntry {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as { runtimeUrl?: unknown }).runtimeUrl === 'string'
  );
}

// Runs once per device: folds the pre-unification runtimes and active-runtime
// keys into the unified key before anything reads or writes through it.
function ensureMigrated(storage: Storage): void {
  if (storage.getItem(PROJECTS_KEY) !== null) return;
  const legacyRuntimes = safeParseArray<ProjectEntry>(storage.getItem(LEGACY_RUNTIMES_KEY));
  if (legacyRuntimes.length === 0) return;

  storage.setItem(PROJECTS_KEY, JSON.stringify(legacyRuntimes));

  const legacyActive = storage.getItem(LEGACY_ACTIVE_RUNTIME_KEY);
  if (legacyActive) storage.setItem(ACTIVE_PROJECT_KEY, legacyActive);
}

function readProjects(storage: Storage | null): ProjectEntry[] {
  if (!storage) return [];
  ensureMigrated(storage);
  return safeParseArray<ProjectEntry>(storage.getItem(PROJECTS_KEY)).filter(isProjectEntry);
}

function writeProjects(storage: Storage | null, projects: ProjectEntry[]): void {
  storage?.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

// Every runtime this device has ever dialled.
export function listProjects(storage: Storage | null): ProjectEntry[] {
  return readProjects(storage);
}

export function activeProjectId(storage: Storage | null): string | null {
  if (!storage) return null;
  ensureMigrated(storage);
  return storage.getItem(ACTIVE_PROJECT_KEY);
}

// A re-dial (the same runtime announcing again, or a reload) carries no label,
// so a name the user already gave this entry is kept rather than dropped.
export function upsertRuntimeProject(
  connection: { runtimeUrl: string; pairingToken: string | null },
  storage: Storage | null,
): ProjectEntry {
  const existing = readProjects(storage);
  const previousLabel = existing.find((entry) => entry.runtimeUrl === connection.runtimeUrl)?.label;
  const entry: ProjectEntry = {
    runtimeUrl: connection.runtimeUrl,
    pairingToken: connection.pairingToken,
    label: previousLabel,
  };
  const projects = existing.filter((candidate) => candidate.runtimeUrl !== connection.runtimeUrl);
  projects.push(entry);
  writeProjects(storage, projects);
  return entry;
}

// Only forgets the entry, never anything git holds — a removed project is
// re-added the same way it was added the first time.
export function removeProject(id: string, storage: Storage | null): void {
  const projects = readProjects(storage).filter((entry) => projectEntryId(entry) !== id);
  writeProjects(storage, projects);
  if (storage?.getItem(ACTIVE_PROJECT_KEY) === id) {
    storage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

// An empty label clears back to whatever name the project itself announces.
export function renameProject(
  id: string,
  label: string,
  storage: Storage | null,
): ProjectEntry | null {
  const projects = readProjects(storage);
  const index = projects.findIndex((entry) => projectEntryId(entry) === id);
  if (index === -1) return null;
  const trimmed = label.trim();
  const renamed: ProjectEntry = { ...projects[index], label: trimmed === '' ? undefined : trimmed };
  projects[index] = renamed;
  writeProjects(storage, projects);
  return renamed;
}

// Switches which already-known project is active. Takes effect on the next
// load for a runtime entry, same as a fresh `?runtime=&token=` link.
export function selectProject(id: string, storage: Storage | null): ProjectEntry | null {
  const match = readProjects(storage).find((entry) => projectEntryId(entry) === id);
  if (!match) return null;
  storage?.setItem(ACTIVE_PROJECT_KEY, id);
  return match;
}
