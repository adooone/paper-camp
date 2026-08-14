const STALENESS_CAP_MS = 14 * 24 * 60 * 60 * 1000;

interface StoredEntry<T> {
  value: T;
  storedAt: number;
}

export function readLocalDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as StoredEntry<T>;
    if (Date.now() - entry.storedAt > STALENESS_CAP_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function writeLocalDraft<T>(key: string, value: T): void {
  try {
    const entry: StoredEntry<T> = { value, storedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage unavailable (e.g. private browsing) — degrade to in-memory only
  }
}

export function removeLocalDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
}
