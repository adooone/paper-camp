// Embedded under a mount prefix, or dialling a runtime it paired with. The hosted
// client starts with neither — the registry IDEA-117 adds will widen this to a
// GitHub-imported, runtime-less project too.
export function hasChosenProject(mountPrefix: string, runtimeUrl: string): boolean {
  return mountPrefix !== '' || runtimeUrl !== '';
}

// The third way in, and the one `paper-camp dev` uses: a bundle a runtime serves is
// same-origin with that runtime's API, so the repo serving the page IS the project —
// nothing to pair, nothing to register, nothing to leave. Only a probe separates it
// from a hosted bundle, which has no API at its own origin. A static host's SPA
// fallback answers 200 with HTML, so the JSON parse is what actually decides.
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

// Reuses the same `?runtime=` query param `runtime-connection.ts` already reads
// and persists — a manually pasted address is adopted exactly like a
// `paper-camp dev` registration link.
export function runtimeAdditionUrl(currentPath: string, runtimeUrl: string): string {
  return `${currentPath}?runtime=${encodeURIComponent(runtimeUrl)}`;
}

// A registered runtime has no announced project name yet — IDEA-117 fans out to
// ask each one, which this shell doesn't do — so the address itself is the only
// row label available today.
export function runtimeRowLabel(runtimeUrl: string): string {
  try {
    return new URL(runtimeUrl).host;
  } catch {
    return runtimeUrl;
  }
}
