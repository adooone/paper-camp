// Local hosting (`paper-camp dev`) always mounts inside the one repo it serves,
// so a non-empty mount prefix always counts as a chosen project. The hosted
// client only has one once it has paired with a runtime — the registry IDEA-117
// adds will widen this to a GitHub-imported, runtime-less project too.
export function hasChosenProject(mountPrefix: string, runtimeUrl: string): boolean {
  return mountPrefix !== '' || runtimeUrl !== '';
}
