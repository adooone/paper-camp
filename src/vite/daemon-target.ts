import { resolve } from 'node:path';
import { daemonStatePath, readRunningDaemonState } from '../core/daemon-state';
import { defaultRegistryPath, loadRegistry } from '../core/machine-registry';

export interface DaemonTarget {
  origin: string;
  slug: string;
}

/** A root the registry doesn't know, or no daemon actually answering on the
 * resolved port, both mean "toolbar off" — the caller can't tell them apart
 * and doesn't need to, `undefined` covers both. `portOverride` stands in for
 * a daemon started by hand, whose real port `daemon.json` may not reflect. */
export async function resolveDaemonTarget(
  root: string,
  portOverride?: number,
): Promise<DaemonTarget | undefined> {
  const registry = await loadRegistry(defaultRegistryPath());
  const project = registry.projects.find((candidate) => candidate.path === resolve(root));
  if (!project) return undefined;

  const port = portOverride ?? (await readRunningDaemonState(daemonStatePath()))?.port;
  if (port === undefined) return undefined;

  return { origin: `http://localhost:${port}`, slug: project.slug };
}
