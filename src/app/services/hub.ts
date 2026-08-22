// Local hosting (`paper-camp dev`) always mounts inside the one repo it serves,
// so a non-empty mount prefix always counts as a chosen project. The hosted
// client only has one once it has paired with a runtime — the registry IDEA-117
// adds will widen this to a GitHub-imported, runtime-less project too.
export function hasChosenProject(mountPrefix: string, runtimeUrl: string): boolean {
  return mountPrefix !== '' || runtimeUrl !== '';
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
