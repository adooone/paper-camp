import { join } from 'node:path';
import { type MachineRegistry, defaultRegistryPath, loadRegistry } from './machine-registry';
import { readEntities } from './readers';

export interface NeedsRef {
  raw: string;
  /** Absent for a same-project ref (`IDEA-N`); set for `<slug>/IDEA-N`. */
  projectSlug?: string;
  id: string;
}

export function parseNeedsRef(raw: string): NeedsRef {
  const slashIndex = raw.indexOf('/');
  if (slashIndex === -1) return { raw, id: raw };
  return { raw, projectSlug: raw.slice(0, slashIndex), id: raw.slice(slashIndex + 1) };
}

export interface ResolvedNeed {
  raw: string;
  found: boolean;
}

/** Resolves each `needs:` entry against the current project (`IDEA-N`) or, via the
 * machine registry, another project registered on the same machine (`<slug>/IDEA-N`).
 * A ref that can't be resolved comes back `found: false` rather than throwing — the
 * caller decides whether that's a write-time warning or a run-time block. */
export async function resolveNeedsRefs(
  root: string,
  needs: string[],
  registry?: MachineRegistry,
): Promise<ResolvedNeed[]> {
  if (needs.length === 0) return [];
  const reg = registry ?? (await loadRegistry(defaultRegistryPath()));
  const idsByRoot = new Map<string, Set<string>>();

  async function idsForRoot(projectRoot: string): Promise<Set<string>> {
    const cached = idsByRoot.get(projectRoot);
    if (cached) return cached;
    const { entries } = await readEntities(join(projectRoot, 'papercamp', 'ideas'));
    const ids = new Set(entries.map((entry) => entry.id));
    idsByRoot.set(projectRoot, ids);
    return ids;
  }

  const results: ResolvedNeed[] = [];
  for (const raw of needs) {
    const ref = parseNeedsRef(raw);
    if (!ref.projectSlug) {
      results.push({ raw, found: (await idsForRoot(root)).has(ref.id) });
      continue;
    }
    const project = reg.projects.find((p) => p.slug === ref.projectSlug);
    if (!project) {
      results.push({ raw, found: false });
      continue;
    }
    results.push({ raw, found: (await idsForRoot(project.path)).has(ref.id) });
  }
  return results;
}
