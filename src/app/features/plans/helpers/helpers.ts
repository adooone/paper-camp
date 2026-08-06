import type { AgentTaskState, PhaseItem, PlanEntry, ThreadMessage } from '@/types/index';

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

const itemProgress = (items: PhaseItem[]) => {
  if (items.length === 0) return null;
  const done = items.filter((p) => p.done).length;
  return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
};

export const phaseProgress = (plan: PlanEntry) => itemProgress(plan.phases);

export const phasePercentage = (plan: PlanEntry): number | null => phaseProgress(plan)?.pct ?? null;

// One bar for the whole plan: phases and fixes counted together.
export const combinedProgress = (plan: PlanEntry) =>
  itemProgress([...plan.phases, ...(plan.fixes ?? [])]);

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

export const canMarkPlanDone = (plan: PlanEntry): boolean =>
  !plan.pr &&
  plan.status !== 'done' &&
  plan.status !== 'dropped' &&
  plan.status !== 'review' &&
  plan.phases.length > 0 &&
  plan.phases.every((p) => p.done) &&
  (plan.fixes ?? []).every((f) => f.done);

export interface OpenQuestionGroup {
  plan: PlanEntry;
  questions: ThreadMessage[];
}

const isOpenQuestion = (message: ThreadMessage): boolean =>
  message.kind === 'question' && (message.state ?? 'open') === 'open';

const byDateAscending = (a: ThreadMessage, b: ThreadMessage): number =>
  (a.date ?? '').localeCompare(b.date ?? '');

/** Every plan carrying at least one open parked question, oldest-first within
 * a plan and groups ordered by their oldest question — mirrors the
 * question/state filter core/stats.ts's countThreadNotes uses for the same count. */
export const collectOpenQuestions = (plans: PlanEntry[]): OpenQuestionGroup[] =>
  plans
    .map((plan) => ({ plan, questions: (plan.thread ?? []).filter(isOpenQuestion) }))
    .filter((group) => group.questions.length > 0)
    .map((group) => ({ plan: group.plan, questions: [...group.questions].sort(byDateAscending) }))
    .sort((a, b) => byDateAscending(a.questions[0], b.questions[0]));

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
