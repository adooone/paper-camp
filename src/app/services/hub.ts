/**
 * A project is chosen once it's embedded under a mount prefix, paired with a
 * runtime it dialled, or pointed at a GitHub corpus source. The hosted
 * client starts with none of the three.
 */
export function hasChosenProject(
  mountPrefix: string,
  runtimeUrl: string,
  githubConfigured: boolean,
): boolean {
  return mountPrefix !== '' || runtimeUrl !== '' || githubConfigured;
}

/**
 * The third way in, and the one `paper-camp dev` uses: a bundle a runtime
 * serves is same-origin with that runtime's API, so the repo serving the
 * page IS the project — nothing to pair, register, or leave. Only a probe
 * separates it from a hosted bundle, which has no API at its own origin. A
 * static host's SPA fallback answers 200 with HTML, so the JSON parse is
 * what actually decides.
 */
export async function servesOwnRuntime(
  runtimeUrl: string,
  fetchApi: (path: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>,
): Promise<boolean> {
  if (runtimeUrl !== '') return false;
  try {
    const response = await fetchApi('/api/capabilities');
    if (!response.ok) return false;
    await response.json();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reuses the same `?runtime=` query param `runtime-connection.ts` already
 * reads and persists, so a manually pasted address is adopted exactly like
 * a `paper-camp dev` registration link.
 */
export function runtimeAdditionUrl(currentPath: string, runtimeUrl: string): string {
  return `${currentPath}?runtime=${encodeURIComponent(runtimeUrl)}`;
}

/**
 * A registered runtime has no announced project name yet, so the address
 * itself is the only row label available.
 */
export function runtimeRowLabel(runtimeUrl: string): string {
  try {
    return new URL(runtimeUrl).host;
  } catch {
    return runtimeUrl;
  }
}

/**
 * A discovered peer already sitting in the registry is not still "addable" —
 * compared by runtimeUrl, the same identity a runtime entry's `projectEntryId` uses.
 */
export function pickableTailnetPeers<T extends { runtimeUrl: string }>(
  peers: T[],
  chosenRuntimeUrls: string[],
): T[] {
  const chosen = new Set(chosenRuntimeUrls);
  return peers.filter((peer) => !chosen.has(peer.runtimeUrl));
}
