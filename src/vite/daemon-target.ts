import { resolve, sep } from 'node:path';
import { daemonStatePath, readRunningDaemonState } from '../core/daemon-state';
import { defaultRegistryPath, loadRegistry } from '../core/machine-registry';

export interface DaemonTarget {
  origin: string;
  slug: string;
}

function containsRoot(projectPath: string, root: string): boolean {
  return root === projectPath || root.startsWith(projectPath + sep);
}

/** A root the registry doesn't know, or no daemon actually answering on the
 * resolved port, both mean "toolbar off" — the caller can't tell them apart
 * and doesn't need to, `undefined` covers both. `portOverride` stands in for
 * a daemon started by hand, whose real port `daemon.json` may not reflect.
 * The Vite root of a monorepo app, e.g. `apps/admin`, sits inside its
 * registered project path rather than equalling it, so matching picks the
 * longest containing path in case projects are nested. */
export async function resolveDaemonTarget(
  root: string,
  portOverride?: number,
): Promise<DaemonTarget | undefined> {
  const registry = await loadRegistry(defaultRegistryPath());
  const resolvedRoot = resolve(root);
  const project = registry.projects
    .filter((candidate) => containsRoot(candidate.path, resolvedRoot))
    .sort((a, b) => b.path.length - a.path.length)[0];
  if (!project) return undefined;

  const port = portOverride ?? (await readRunningDaemonState(daemonStatePath()))?.port;
  if (port === undefined) return undefined;

  return { origin: `http://localhost:${port}`, slug: project.slug };
}
