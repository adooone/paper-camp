import type { EntityKind, EntityStatus, PhaseItem, PlanStatus, PrInfo } from '../../types/index';

export interface StatusDerivationInput {
  kind?: EntityKind;
  status?: EntityStatus;
  phases: PhaseItem[];
  fixes?: PhaseItem[];
  archived?: boolean;
}

export type ArchivabilityInput = StatusDerivationInput;

/**
 * The fix/reopen boundary predicate (IDEA-187): a done/archived entity's file is
 * read-only, so new work spawns a linked fix entity instead. Reads the stored status,
 * not the derived one — a merged-but-not-yet-archived idea counts once `status: done`
 * is actually stamped (readEntities sets `archived` from the file's directory).
 */
export function isClosedEntity(entity: { status?: EntityStatus; archived?: boolean }): boolean {
  return entity.archived === true || entity.status === 'done';
}

function allChecked(entity: StatusDerivationInput): boolean {
  const phasesDone = entity.phases.length > 0 && entity.phases.every((p) => p.done);
  const fixesDone = (entity.fixes ?? []).every((f) => f.done);
  return phasesDone && fixesDone;
}

// Keys off the PR (matched by id), not a local branch: canonical across clones
// and survives the branch being deleted after merge.
export function deriveStatus(
  entity: StatusDerivationInput,
  pr: PrInfo | undefined,
  prLookupResolved: boolean,
  hasMainActivity = false,
): EntityStatus | undefined {
  if (entity.kind === 'note') return entity.status;
  // `dropped` can't be derived (abandonment leaves no trace), so a stored one always wins.
  if (entity.status === 'dropped') return entity.status;
  // An entity in archive/ is closed by definition, regardless of PR lookup state.
  if (entity.archived) return 'done';
  if (pr) {
    if (pr.state === 'merged') return allChecked(entity) ? 'done' : 'planned';
    if (pr.state === 'closed') return 'dropped';
    return allChecked(entity) ? 'review' : 'in-progress';
  }
  if (!prLookupResolved) {
    // GitHub unreachable — trust the stored override, else a phases-only guess.
    return entity.status ?? (entity.phases.length > 0 ? 'planned' : 'idea');
  }
  // Confirmed no PR, but a stored `review`/`done` (e.g. direct-to-main work, or an
  // unmatchable legacy PR) still wins over a planned/in-progress guess.
  if (entity.status === 'review' || entity.status === 'done') return entity.status;
  if (hasMainActivity && entity.phases.length > 0) {
    return allChecked(entity) ? 'review' : 'in-progress';
  }
  return entity.phases.length > 0 ? 'planned' : 'idea';
}

/**
 * Mirrors deriveStatus's guards up to its `!prLookupResolved` branch: true exactly when
 * GitHub was unreachable and nothing derivable (archived/dropped/a resolved PR) overrode
 * the guess.
 */
export function isStatusFallback(
  entity: StatusDerivationInput,
  pr: PrInfo | undefined,
  prLookupResolved: boolean,
): boolean {
  if (entity.kind === 'note' || entity.kind === 'board') return false;
  if (entity.status === 'dropped') return false;
  if (entity.archived) return false;
  if (pr) return false;
  return !prLookupResolved;
}

// A merged PR can still derive to `dropped` (a stored override wins over the PR — see
// deriveStatus), so this re-derives rather than trusting `pr.state === 'merged'` alone.
export function isArchivable(entity: ArchivabilityInput, pr: PrInfo | undefined): boolean {
  if (entity.kind === 'note' || entity.archived || pr?.state !== 'merged') return false;
  const status = deriveStatus(entity, pr, true);
  return status === 'review' || status === 'done';
}

/**
 * A board's status rolls up from its tickets' derived statuses, the way a plan's rolls
 * up from its phases, capped at `review` since closing an entity is always a human
 * promotion (IDEA-187), never automatic.
 */
export function deriveBoardStatus(ticketStatuses: EntityStatus[]): PlanStatus {
  if (ticketStatuses.length === 0) return 'idea';
  if (ticketStatuses.every((s) => s === 'done' || s === 'dropped')) return 'review';
  if (ticketStatuses.some((s) => s !== 'idea' && s !== 'planned')) return 'in-progress';
  return 'planned';
}
