const HUB_REPOS_KEY = 'paper-camp.hubRepos';

function readHubRepos(storage: Storage | null): string[] {
  const raw = storage?.getItem(HUB_REPOS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as string[]) : [];
}

// The hub's working set, so hub views don't refetch and re-filter everything
// a connected GitHub token can reach.
export function listHubRepos(storage: Storage | null): string[] {
  return readHubRepos(storage);
}

export function addHubRepo(repoName: string, storage: Storage | null): string[] {
  const existing = readHubRepos(storage);
  const repos = existing.includes(repoName) ? existing : [...existing, repoName];
  storage?.setItem(HUB_REPOS_KEY, JSON.stringify(repos));
  return repos;
}

export function removeHubRepo(repoName: string, storage: Storage | null): string[] {
  const repos = readHubRepos(storage).filter((name) => name !== repoName);
  storage?.setItem(HUB_REPOS_KEY, JSON.stringify(repos));
  return repos;
}
