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
 * (branch exists) -> review (branch + every phase checked) -> done (PR
 * merged, IDEA-56 phase 3). `dropped` can never be derived (abandonment
 * leaves no trace), so it always passes through as stored. Notes track
 * open/done/dropped by hand and never grow phases or branches, so they
 * always pass through unchanged.
 *
 * `hasBranch` is `undefined` when git itself is unavailable (no repo, no git
 * binary) — in that case the four locally-derivable rungs fall back to
 * whatever is stored, or the phases-only guess of `planned`.
 *
 * `prMerged` is the live PR-merged lookup (see `resolvePrMerged`):
 * `true` derives `done` outright (even overriding a stale stored value that
 * says otherwise); `undefined` means the lookup couldn't be resolved (no
 * `gh`, offline, ...), so a stored `done` is trusted as the offline
 * fallback; `false` is a confirmed non-merge and falls through to the rest
 * of the ladder, which can correct a stale stored `done` back down.
 */
export function deriveStatus(
  entity: StatusDerivationInput,
  hasBranch: boolean | undefined,
  prMerged?: boolean,
): EntityStatus | undefined {
  if (entity.kind === 'note') return entity.status;
  if (entity.status === 'dropped') return entity.status;
  if (prMerged) return 'done';
  if (prMerged === undefined && entity.status === 'done') return entity.status;
  if (entity.phases.length === 0) return 'idea';
  if (hasBranch === undefined) return entity.status ?? 'planned';
  if (!hasBranch) return 'planned';
  return entity.phases.every((p) => p.done) ? 'review' : 'in-progress';
}
