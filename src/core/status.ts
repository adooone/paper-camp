import type { EntityStatus, PhaseItem, PrInfo } from '../types/index';

/** The subset of an entity's shape the status ladder needs to look at. */
export interface StatusDerivationInput {
  kind?: 'note';
  status?: EntityStatus;
  phases: PhaseItem[];
}

function allChecked(entity: StatusDerivationInput): boolean {
  return entity.phases.length > 0 && entity.phases.every((p) => p.done);
}

/**
 * Derives lifecycle status from the entity's phases and its GitHub PR instead of
 * trusting the stored `status` field, so it can't drift from reality. Tracking
 * keys off the PR (matched by id), not a local branch: the PR is canonical
 * across clones and survives the branch being deleted after merge.
 *
 * Ladder: idea (no phases) -> planned (phases, no PR) -> in-progress (PR open or
 * draft) -> review (PR open/draft AND every phase checked) -> done (PR merged).
 * A closed-unmerged PR reads as `dropped`. `dropped` can never be derived
 * (abandonment leaves no trace), so a stored `dropped` always passes through;
 * notes track open/done/dropped by hand and pass through unchanged.
 *
 * `pr` is the entity's resolved PR, or `undefined` when it has none / the lookup
 * couldn't run. `prLookupResolved` says which: `false` (no `gh`, offline) falls
 * the PR-backed rungs back to the stored override or a phases-only `planned`;
 * `true` with no PR is a confirmed "no PR", so it derives `planned`/`idea` (a
 * stored terminal `done` from an unmatchable legacy PR is still trusted).
 */
export function deriveStatus(
  entity: StatusDerivationInput,
  pr: PrInfo | undefined,
  prLookupResolved: boolean,
): EntityStatus | undefined {
  if (entity.kind === 'note') return entity.status;
  if (entity.status === 'dropped') return entity.status;
  if (pr) {
    if (pr.state === 'merged') return 'done';
    if (pr.state === 'closed') return 'dropped';
    return allChecked(entity) ? 'review' : 'in-progress';
  }
  if (!prLookupResolved) {
    // GitHub unreachable — trust the stored override, else a phases-only guess.
    return entity.status ?? (entity.phases.length > 0 ? 'planned' : 'idea');
  }
  // Resolved, and this entity has no PR. A stored terminal `done` (e.g. a legacy
  // entity whose old PR isn't matchable by id) is still trusted.
  if (entity.status === 'done') return 'done';
  return entity.phases.length > 0 ? 'planned' : 'idea';
}
