import type { ResolvedNeed } from '../types/index';

export function isBlockingNeed(need: ResolvedNeed): boolean {
  return need.found && !need.done;
}

export function hasBlockingNeed(resolvedNeeds?: ResolvedNeed[]): boolean {
  return (resolvedNeeds ?? []).some(isBlockingNeed);
}
