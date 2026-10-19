import type { EntityEntry, PlanEntry, ResolvedNeed } from '../types/index';
import { readCorpus } from './corpus';
import { type MachineRegistry, defaultRegistryPath, loadRegistry } from './machine-registry';
import { isBlockingNeed } from './needs-status';
import { isClosedEntity } from './status';

export { isBlockingNeed, hasBlockingNeed } from './needs-status';

export interface NeedsRef {
  raw: string;
  /** Absent for a same-project ref (`IDEA-N`); set for `<slug>/IDEA-N`. */
  projectSlug?: string;
  id: string;
}

/** A project root's entries keyed by id, shared across one batch of `needs:`
 * resolutions (attachResolvedNeeds/computeNeedsBlockedIds) so every ref into the
 * same root reads it once instead of once per entity. */
export type EntriesByRoot = Map<string, Map<string, EntityEntry>>;

export function parseNeedsRef(raw: string): NeedsRef {
  const slashIndex = raw.indexOf('/');
  if (slashIndex === -1) return { raw, id: raw };
  return { raw, projectSlug: raw.slice(0, slashIndex), id: raw.slice(slashIndex + 1) };
}

/** Resolves each `needs:` entry against the current project (`IDEA-N`) or, via the
 * machine registry, another project registered on the same machine (`<slug>/IDEA-N`).
 * A ref that can't be resolved comes back `found: false` rather than throwing — the
 * caller decides whether that's a write-time warning or a run-time block. `done`
 * reads the DERIVED status (PR-aware), matching what the UI shows elsewhere. */
export async function resolveNeedsRefs(
  root: string,
  needs: string[],
  registry?: MachineRegistry,
  entriesByRoot: EntriesByRoot = new Map(),
): Promise<ResolvedNeed[]> {
  if (needs.length === 0) return [];
  const reg = registry ?? (await loadRegistry(defaultRegistryPath()));

  async function entriesForRoot(projectRoot: string): Promise<Map<string, EntityEntry>> {
    const cached = entriesByRoot.get(projectRoot);
    if (cached) return cached;
    const { entries } = await readCorpus(projectRoot);
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    entriesByRoot.set(projectRoot, byId);
    return byId;
  }

  const results: ResolvedNeed[] = [];
  for (const raw of needs) {
    const ref = parseNeedsRef(raw);
    const project = ref.projectSlug
      ? reg.projects.find((p) => p.slug === ref.projectSlug)
      : undefined;
    if (ref.projectSlug && !project) {
      results.push({ raw, id: ref.id, projectSlug: ref.projectSlug, found: false });
      continue;
    }
    const entry = (await entriesForRoot(project?.path ?? root)).get(ref.id);
    if (!entry) {
      results.push({ raw, id: ref.id, projectSlug: ref.projectSlug, found: false });
      continue;
    }
    results.push({
      raw,
      id: ref.id,
      projectSlug: ref.projectSlug,
      found: true,
      done: isClosedEntity(entry),
      title: entry.title,
      projectName: project?.name,
    });
  }
  return results;
}

/** Attaches `resolvedNeeds` to every plan that carries a `needs:` list, sharing one
 * registry load and one set of per-project entity reads across the whole batch —
 * called once per corpus read (see `readCorpus`), not per plan. */
export async function attachResolvedNeeds(
  root: string,
  plans: PlanEntry[],
  entriesByRoot: EntriesByRoot = new Map(),
): Promise<PlanEntry[]> {
  if (plans.every((plan) => plan.needs.length === 0)) return plans;
  const registry = await loadRegistry(defaultRegistryPath());
  return Promise.all(
    plans.map(async (plan) => {
      if (plan.needs.length === 0) return plan;
      return {
        ...plan,
        resolvedNeeds: await resolveNeedsRefs(root, plan.needs, registry, entriesByRoot),
      };
    }),
  );
}

/** The ids among `entries` a run-order picker must skip — a blocking need keeps an
 * otherwise-orderable entity out of the queue (IDEA-291). Shares one registry load
 * across the whole corpus, like `attachResolvedNeeds`. */
export async function computeNeedsBlockedIds(
  root: string,
  entries: { id: string; needs: string[] }[],
  entriesByRoot: EntriesByRoot = new Map(),
): Promise<Set<string>> {
  const withNeeds = entries.filter((e) => e.needs.length > 0);
  if (withNeeds.length === 0) return new Set();
  const registry = await loadRegistry(defaultRegistryPath());
  const blocked = new Set<string>();
  for (const entry of withNeeds) {
    const resolved = await resolveNeedsRefs(root, entry.needs, registry, entriesByRoot);
    if (resolved.some(isBlockingNeed)) blocked.add(entry.id);
  }
  return blocked;
}

/** Refuses a phase/run-all launch whose plan waits on an unmet need — the first
 * blocking need wins when there's more than one. A ref that can't be resolved
 * never blocks (see `isBlockingNeed`). */
export async function checkNeedsForRun(root: string, needs: string[]): Promise<string | null> {
  if (needs.length === 0) return null;
  const blocking = (await resolveNeedsRefs(root, needs)).find(isBlockingNeed);
  if (!blocking) return null;
  return `waits for ${blocking.projectName ? `${blocking.projectName} ` : ''}${blocking.id}`;
}
