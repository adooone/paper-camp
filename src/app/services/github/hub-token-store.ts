const STORAGE_KEY = 'papercamp:github-hub-token';

/**
 * Device-local, like `config-store.ts` — but the hub's own token, not scoped
 * to a single repo: this is what the welcome screen connects before any
 * project (and therefore any owner/repo) is chosen.
 */
export function readHubGithubToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeHubGithubToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // localStorage unavailable (e.g. private browsing) — the connection can't persist here
  }
}

export function clearHubGithubToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}
