const KEY_PREFIX = 'paper-camp.lastRoute:';

function keyFor(runtimeUrl: string): string {
  return `${KEY_PREFIX}${runtimeUrl}`;
}

interface StoredRoute {
  pathname: string;
  at: string;
}

// Pre-hub-model entries stored the bare pathname string; still readable, just
// with no recorded time — the hub model treats that as "never opened" for sorting.
function parseStored(raw: string | null): StoredRoute | null {
  if (!raw) return null;
  if (raw[0] !== '{') return { pathname: raw, at: '' };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRoute>;
    return typeof parsed.pathname === 'string'
      ? { pathname: parsed.pathname, at: typeof parsed.at === 'string' ? parsed.at : '' }
      : null;
  } catch {
    return null;
  }
}

export function rememberRoute(runtimeUrl: string, pathname: string, storage: Storage | null): void {
  try {
    const entry: StoredRoute = { pathname, at: new Date().toISOString() };
    storage?.setItem(keyFor(runtimeUrl), JSON.stringify(entry));
  } catch {
    // localStorage unavailable (e.g. private browsing) — degrade to in-memory only
  }
}

// `/` is already the default for a never-visited project, so there's nothing
// to redirect to; `routeExists` clears a route a later app version dropped.
export function lastRouteFor(
  runtimeUrl: string,
  storage: Storage | null,
  routeExists: (pathname: string) => boolean,
): string | null {
  let stored: StoredRoute | null;
  try {
    stored = parseStored(storage?.getItem(keyFor(runtimeUrl)) ?? null);
  } catch {
    return null;
  }
  if (!stored || stored.pathname === '/') return null;
  if (routeExists(stored.pathname)) return stored.pathname;
  try {
    storage?.removeItem(keyFor(runtimeUrl));
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
  return null;
}

// The hub model's "when this browser last opened it" — null when never
// recorded, or recorded before this timestamp was introduced.
export function lastOpenedAt(runtimeUrl: string, storage: Storage | null): string | null {
  try {
    const stored = parseStored(storage?.getItem(keyFor(runtimeUrl)) ?? null);
    return stored?.at || null;
  } catch {
    return null;
  }
}
