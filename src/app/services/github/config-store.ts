const STORAGE_KEY = 'papercamp:github-corpus';

export interface GithubCorpusConfig {
  token: string;
  owner: string;
  repo: string;
}

// Device-local, like `local-draft-store.ts` — but a credential, not a draft, so it
// gets its own store rather than reusing one with a staleness cap that would expire it.
export function readGithubConfig(): GithubCorpusConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GithubCorpusConfig>;
    if (!parsed.token || !parsed.owner || !parsed.repo) return null;
    return { token: parsed.token, owner: parsed.owner, repo: parsed.repo };
  } catch {
    return null;
  }
}

export function writeGithubConfig(config: GithubCorpusConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage unavailable (e.g. private browsing) — plan-only can't persist here
  }
}

export function clearGithubConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
