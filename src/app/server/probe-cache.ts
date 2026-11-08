interface ProbeEntry {
  value: unknown;
  loadedAt: number;
  refreshing: Promise<unknown> | null;
}

export interface ProbeOptions<T> {
  fresh?: boolean;
  onChange?: (value: T) => void;
}

const entries = new Map<string, ProbeEntry>();
const firstLoads = new Map<string, Promise<unknown>>();

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function clearProbe(key: string): void {
  entries.delete(key);
  firstLoads.delete(key);
}

export function clearProbesWithPrefix(prefix: string): void {
  for (const key of [...entries.keys(), ...firstLoads.keys()]) {
    if (key.startsWith(prefix)) clearProbe(key);
  }
}

function refresh<T>(
  key: string,
  entry: ProbeEntry,
  load: () => Promise<T>,
  onChange?: (value: T) => void,
): Promise<T> {
  if (entry.refreshing) return entry.refreshing as Promise<T>;
  const pending = load()
    .then((value) => {
      const changed = !sameValue(entry.value, value);
      entry.value = value;
      entry.loadedAt = Date.now();
      if (changed && entries.get(key) === entry) onChange?.(value);
      return value;
    })
    .finally(() => {
      entry.refreshing = null;
    });
  entry.refreshing = pending;
  return pending;
}

export async function cachedProbe<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
  options: ProbeOptions<T> = {},
): Promise<T> {
  const entry = entries.get(key);
  if (entry) {
    if (options.fresh) return refresh(key, entry, load, options.onChange);
    if (Date.now() - entry.loadedAt >= ttlMs) {
      refresh(key, entry, load, options.onChange).catch(() => undefined);
    }
    return entry.value as T;
  }

  const inFlight = firstLoads.get(key);
  if (inFlight) return inFlight as Promise<T>;
  const first = load()
    .then((value) => {
      entries.set(key, { value, loadedAt: Date.now(), refreshing: null });
      return value;
    })
    .finally(() => {
      firstLoads.delete(key);
    });
  firstLoads.set(key, first);
  return first;
}
