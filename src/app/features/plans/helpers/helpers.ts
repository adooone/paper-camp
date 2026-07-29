import type {
  AgentTaskState,
  DecisionEntry,
  MarginNote,
  MarginNoteAnchor,
  PlanEntry,
} from '@/types/index';

export const relativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export const phaseProgress = (plan: PlanEntry) => {
  if (plan.phases.length === 0) return null;
  const done = plan.phases.filter((p) => p.done).length;
  return { done, total: plan.phases.length, pct: Math.round((done / plan.phases.length) * 100) };
};

export const phasePercentage = (plan: PlanEntry): number | null => phaseProgress(plan)?.pct ?? null;

export const runningTaskForPlan = (
  planId: string | undefined,
  agentStatus: AgentTaskState[],
): AgentTaskState | undefined =>
  planId
    ? agentStatus.find((t) => t.planId === planId && t.status !== 'done' && t.status !== 'error')
    : undefined;

/** Overlays a live agent task onto the stored/derived status for display only —
 * frontmatter and the derived status used for filtering/sorting stay untouched. */
export const effectiveStatus = (
  plan: PlanEntry,
  agentStatus: AgentTaskState[],
): PlanEntry['status'] => {
  if (plan.status === 'done' || plan.status === 'dropped') return plan.status;
  return runningTaskForPlan(plan.id, agentStatus) ? 'in-progress' : plan.status;
};

export const notesForAnchor = (
  notes: MarginNote[] | undefined,
  anchor: MarginNoteAnchor,
): MarginNote[] =>
  (notes ?? []).filter(
    (note) =>
      note.state === 'open' &&
      (anchor.kind === 'phase'
        ? note.anchor.kind === 'phase' && note.anchor.index === anchor.index
        : note.anchor.kind === 'body'),
  );

export const openMarginNotes = (notes: MarginNote[] | undefined): MarginNote[] =>
  (notes ?? []).filter((note) => note.state === 'open');

const sameAnchor = (a: MarginNoteAnchor, b: MarginNoteAnchor): boolean =>
  a.kind === 'phase' && b.kind === 'phase' ? a.index === b.index : a.kind === b.kind;

// Matches by (anchor, prose) rather than identity: a bundled note's array reference
// won't survive the reload between launching a rework and approving its preview.
export const resolveAppliedNotes = (
  notes: MarginNote[] | undefined,
  applied: MarginNote[],
): MarginNote[] =>
  (notes ?? []).map((note) =>
    note.state === 'open' &&
    applied.some((a) => sameAnchor(a.anchor, note.anchor) && a.prose === note.prose)
      ? { ...note, state: 'resolved' as const }
      : note,
  );

/** Decisions whose tags overlap the plan's tags or subject — its logged guardrails. */
export const relevantDecisions = (
  decisions: DecisionEntry[],
  plan: Pick<PlanEntry, 'tags' | 'subject'>,
): DecisionEntry[] => {
  const planTags = new Set(plan.tags);
  if (plan.subject) planTags.add(plan.subject);
  if (planTags.size === 0) return [];
  return decisions
    .filter((d) => (d.tags ?? []).some((t) => planTags.has(t)))
    .sort((a, b) => b.date.localeCompare(a.date));
};

/** Decisions matching a free-text query against title, tags, and body. */
export const searchDecisions = (decisions: DecisionEntry[], query: string): DecisionEntry[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return decisions
    .filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.body.toLowerCase().includes(q) ||
        (d.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const findFocusPlan = (
  plans: PlanEntry[] | undefined,
  activePlanTitle?: string | null,
): PlanEntry | undefined => {
  if (!plans) return undefined;
  if (activePlanTitle) {
    const selected = plans.find((p) => p.title === activePlanTitle);
    if (selected) return selected;
  }
  return plans.find((p) => p.status === 'in-progress' || p.status === 'review');
};
