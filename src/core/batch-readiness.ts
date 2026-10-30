import type { PhaseItem, ResolvedNeed, ThreadMessage } from '../types/index';
import { isBlockingNeed } from './needs-status';

export type BatchReadinessReason =
  | 'needs'
  | 'manual-only'
  | 'open-question'
  | 'stale-base'
  | 'no-agent';

export type BatchReadiness =
  | { ready: true }
  | { ready: false; reason: BatchReadinessReason; message: string };

function hasRunnableWork(phases: PhaseItem[], fixes: PhaseItem[]): boolean {
  return [...phases, ...fixes].some((item) => !item.done && item.source !== 'manual');
}

function hasOpenQuestion(thread: ThreadMessage[]): boolean {
  return thread.some((m) => m.kind === 'question' && (m.state ?? 'open') === 'open');
}

/**
 * Whether an idea/plan can be run unattended right now — `ready`, or the first
 * reason it isn't, in the order IDEA-321 lists them. Callers resolve each input
 * (needs, thread, git staleness, agent config) the same way `startRunAllPhases`
 * and the run-order pass already do, so this stays a pure combinator over
 * already-resolved facts rather than redoing any of that I/O.
 */
export function batchReadiness(entity: {
  resolvedNeeds?: ResolvedNeed[];
  phases: PhaseItem[];
  fixes?: PhaseItem[];
  thread?: ThreadMessage[];
  staleBase: string | null;
  hasAgent: boolean;
}): BatchReadiness {
  const blockingNeed = (entity.resolvedNeeds ?? []).find(isBlockingNeed);
  if (blockingNeed) {
    const label = blockingNeed.projectName ? `${blockingNeed.projectName} ` : '';
    return { ready: false, reason: 'needs', message: `waits for ${label}${blockingNeed.id}` };
  }

  if (!hasRunnableWork(entity.phases, entity.fixes ?? [])) {
    return { ready: false, reason: 'manual-only', message: 'only manual steps left' };
  }

  if (hasOpenQuestion(entity.thread ?? [])) {
    return { ready: false, reason: 'open-question', message: 'waiting on your answer' };
  }

  if (entity.staleBase) {
    return { ready: false, reason: 'stale-base', message: entity.staleBase };
  }

  if (!entity.hasAgent) {
    return { ready: false, reason: 'no-agent', message: 'no agent set up' };
  }

  return { ready: true };
}

export interface BatchBacklogItem {
  id: string;
  title: string;
  hasPhases: boolean;
}

/** Ideas that can't join the queue yet because their derived status is still `idea`:
 * either no phases (draft them first) or phases under a stored `idea` status that
 * the derivation couldn't promote (mark them planned). Oldest first, like the run
 * order's own append rule. */
export function selectBatchBacklog(
  classified: { id: string; title: string; created: string; status?: string }[],
  entries: { id: string; phases: PhaseItem[] }[],
): BatchBacklogItem[] {
  const phasesById = new Map(entries.map((e) => [e.id, e.phases]));
  return classified
    .filter((e) => e.status === 'idea')
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((e) => ({
      id: e.id,
      title: e.title,
      hasPhases: (phasesById.get(e.id)?.length ?? 0) > 0,
    }));
}
