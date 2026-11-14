export const READ_CACHE_TTL_MS = 5 * 60_000;

export interface ReadCache<T> {
  get: () => Promise<T>;
  drop: () => void;
}

export function createReadCache<T>(
  compute: () => Promise<T>,
  ttlMs = READ_CACHE_TTL_MS,
): ReadCache<T> {
  let entry: { value: Promise<T>; at: number } | null = null;

  return {
    get() {
      if (entry && Date.now() - entry.at < ttlMs) return entry.value;
      const value = compute();
      const current = { value, at: Date.now() };
      entry = current;
      value.catch(() => {
        if (entry === current) entry = null;
      });
      return value;
    },
    drop() {
      entry = null;
    },
  };
}
