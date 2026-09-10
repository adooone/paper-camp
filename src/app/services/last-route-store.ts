const KEY_PREFIX = 'paper-camp.lastRoute:';

function keyFor(runtimeUrl: string): string {
  return `${KEY_PREFIX}${runtimeUrl}`;
}

export function rememberRoute(runtimeUrl: string, pathname: string, storage: Storage | null): void {
  try {
    storage?.setItem(keyFor(runtimeUrl), pathname);
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
  let stored: string | null;
  try {
    stored = storage?.getItem(keyFor(runtimeUrl)) ?? null;
  } catch {
    return null;
  }
  if (!stored || stored === '/') return null;
  if (routeExists(stored)) return stored;
  try {
    storage?.removeItem(keyFor(runtimeUrl));
  } catch {
    // localStorage unavailable (e.g. private browsing)
  }
  return null;
}
