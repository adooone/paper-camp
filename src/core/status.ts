import type { EntityStatus, PhaseItem } from '../types/index';

/** The subset of an entity's shape the status ladder needs to look at. */
export interface StatusDerivationInput {
  kind?: 'note';
  status?: EntityStatus;
  phases: PhaseItem[];
}

/**
 * Derives lifecycle status from observable state instead of trusting the
 * stored `status` field, so it can't drift from reality — see IDEA-56.
 *
 * Ladder: idea (no phases) -> planned (phases, no branch) -> in-progress
 * (branch exists) -> review (branch + every phase checked). `done` isn't
 * derivable yet (needs a PR lookup, IDEA-56 phase 3) and `dropped` can never
 * be derived (abandonment leaves no trace), so both pass through as stored.
 * Notes track open/done/dropped by hand and never grow phases or branches,
 * so they always pass through unchanged.
 *
 * `hasBranch` is `undefined` when git itself is unavailable (no repo, no git
 * binary) — in that case the four derivable rungs fall back to whatever is
 * stored, or the phases-only guess of `planned`.
 */
export function deriveStatus(
  entity: StatusDerivationInput,
  hasBranch: boolean | undefined,
): EntityStatus | undefined {
  if (entity.kind === 'note') return entity.status;
  if (entity.status === 'dropped' || entity.status === 'done') return entity.status;
  if (entity.phases.length === 0) return 'idea';
  if (hasBranch === undefined) return entity.status ?? 'planned';
  if (!hasBranch) return 'planned';
  return entity.phases.every((p) => p.done) ? 'review' : 'in-progress';
}
