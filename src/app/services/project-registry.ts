const PROJECTS_KEY = 'paper-camp.projects';
const ACTIVE_PROJECT_KEY = 'paper-camp.activeProjectId';

// Pre-unification keys — read once to carry an existing device's paired
// runtimes and chosen repos into the unified store instead of losing them.
const LEGACY_RUNTIMES_KEY = 'paper-camp.runtimes';
const LEGACY_ACTIVE_RUNTIME_KEY = 'paper-camp.activeRuntimeUrl';
const LEGACY_HUB_REPOS_KEY = 'paper-camp.hubRepos';

export interface RuntimeProjectEntry {
  kind: 'runtime';
  runtimeUrl: string;
  pairingToken: string | null;
  label?: string;
}

export interface GithubProjectEntry {
  kind: 'github';
  owner: string;
  repo: string;
  label?: string;
}

export type ProjectEntry = RuntimeProjectEntry | GithubProjectEntry;

export function projectEntryId(entry: ProjectEntry): string {
  return entry.kind === 'runtime' ? entry.runtimeUrl : `${entry.owner}/${entry.repo}`;
}

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function splitRepoFullName(repoFullName: string): [owner: string, repo: string] {
  const slash = repoFullName.indexOf('/');
  return slash === -1
    ? [repoFullName, '']
    : [repoFullName.slice(0, slash), repoFullName.slice(slash + 1)];
}

// Runs once per device: folds the pre-unification runtimes/repos/active-runtime
// keys into the unified key before anything reads or writes through it.
function ensureMigrated(storage: Storage): void {
  if (storage.getItem(PROJECTS_KEY) !== null) return;
  const legacyRuntimes = safeParseArray<{
    runtimeUrl: string;
    pairingToken: string | null;
    label?: string;
  }>(storage.getItem(LEGACY_RUNTIMES_KEY));
  const legacyRepos = safeParseArray<string>(storage.getItem(LEGACY_HUB_REPOS_KEY));
  if (legacyRuntimes.length === 0 && legacyRepos.length === 0) return;

  const projects: ProjectEntry[] = [
    ...legacyRuntimes.map(
      (r): RuntimeProjectEntry => ({
        kind: 'runtime',
        runtimeUrl: r.runtimeUrl,
        pairingToken: r.pairingToken,
        label: r.label,
      }),
    ),
    ...legacyRepos.map((full): GithubProjectEntry => {
      const [owner, repo] = splitRepoFullName(full);
      return { kind: 'github', owner, repo };
    }),
  ];
  storage.setItem(PROJECTS_KEY, JSON.stringify(projects));

  const legacyActive = storage.getItem(LEGACY_ACTIVE_RUNTIME_KEY);
  if (legacyActive) storage.setItem(ACTIVE_PROJECT_KEY, legacyActive);
}

function readProjects(storage: Storage | null): ProjectEntry[] {
  if (!storage) return [];
  ensureMigrated(storage);
  return safeParseArray<ProjectEntry>(storage.getItem(PROJECTS_KEY));
}

function writeProjects(storage: Storage | null, projects: ProjectEntry[]): void {
  storage?.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

// Every project this device knows about, runtime-backed or GitHub-backed.
export function listProjects(storage: Storage | null): ProjectEntry[] {
  return readProjects(storage);
}

export function listGithubRepoNames(storage: Storage | null): string[] {
  return readProjects(storage)
    .filter((entry): entry is GithubProjectEntry => entry.kind === 'github')
    .map((entry) => `${entry.owner}/${entry.repo}`);
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
): RuntimeProjectEntry {
  const existing = readProjects(storage);
  const previousLabel = existing.find(
    (entry): entry is RuntimeProjectEntry =>
      entry.kind === 'runtime' && entry.runtimeUrl === connection.runtimeUrl,
  )?.label;
  const entry: RuntimeProjectEntry = {
    kind: 'runtime',
    runtimeUrl: connection.runtimeUrl,
    pairingToken: connection.pairingToken,
    label: previousLabel,
  };
  const projects = existing.filter(
    (candidate) =>
      !(candidate.kind === 'runtime' && candidate.runtimeUrl === connection.runtimeUrl),
  );
  projects.push(entry);
  writeProjects(storage, projects);
  return entry;
}

export function addGithubProject(
  repoFullName: string,
  storage: Storage | null,
): GithubProjectEntry {
  const [owner, repo] = splitRepoFullName(repoFullName);
  const existing = readProjects(storage);
  const found = existing.find(
    (entry): entry is GithubProjectEntry =>
      entry.kind === 'github' && entry.owner === owner && entry.repo === repo,
  );
  if (found) return found;
  const entry: GithubProjectEntry = { kind: 'github', owner, repo };
  writeProjects(storage, [...existing, entry]);
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
