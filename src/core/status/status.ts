import type { EntityStatus, PhaseItem, PrInfo } from '../../types/index';

export interface StatusDerivationInput {
  kind?: 'note';
  status?: EntityStatus;
  phases: PhaseItem[];
}

function allChecked(entity: StatusDerivationInput): boolean {
  return entity.phases.length > 0 && entity.phases.every((p) => p.done);
}

// Keys off the PR (matched by id), not a local branch: canonical across clones
// and survives the branch being deleted after merge.
export function deriveStatus(
  entity: StatusDerivationInput,
  pr: PrInfo | undefined,
  prLookupResolved: boolean,
): EntityStatus | undefined {
  if (entity.kind === 'note') return entity.status;
  // `dropped` can't be derived (abandonment leaves no trace), so a stored one always wins.
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
  // Confirmed no PR, but a stored terminal `done` (e.g. an unmatchable legacy PR) still wins.
  if (entity.status === 'done') return 'done';
  return entity.phases.length > 0 ? 'planned' : 'idea';
}
