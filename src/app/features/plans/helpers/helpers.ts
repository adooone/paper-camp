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

// Time-only when the fetch was today (GitHub data is read on demand — "as of
// 14:32" is how stale a PR-derived status is allowed to look before refreshing).
export const formatFetchedAt = (fetchedAt: number): string => {
  const date = new Date(fetchedAt);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `as of ${time}` : `as of ${date.toLocaleDateString()} ${time}`;
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

export const rollupProgress = (
  plan: PlanEntry,
  runningFraction: number,
): { done: number; total: number; pct: number } | null => {
  const base = combinedProgress(plan);
  if (!base) return null;
  const filled = Math.min(base.total, base.done + runningFraction);
  return { done: base.done, total: base.total, pct: (filled / base.total) * 100 };
};

export const runningTaskForPlan = (
  planId: string | undefined,
  agentStatus: AgentTaskState[],
): AgentTaskState | undefined =>
  planId
    ? agentStatus.find((t) => t.planId === planId && t.status !== 'done' && t.status !== 'error')
    : undefined;

export const runningPrReviewForPlan = (
  planId: string | undefined,
  agentStatus: AgentTaskState[],
): AgentTaskState | undefined =>
  planId
    ? agentStatus.find(
        (t) =>
          t.planId === planId &&
          t.taskKind === 'pr-review' &&
          t.status !== 'done' &&
          t.status !== 'error',
      )
    : undefined;

export const latestReviewNote = (thread: ThreadMessage[] | undefined): string | undefined =>
  [...(thread ?? [])].reverse().find((m) => m.kind === 'review')?.text;

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

export interface CompletionGateResult {
  ready: boolean;
  missing: string[];
}

/** Gates the merge-and-reset completion action (IDEA-194): recomputes from raw
 * phases/fixes/PR/CI rather than trusting `plan.status`, the same "derive, don't
 * assert" rule deriveStatus follows. `ciGreen` comes from `usePrReviewStatus`,
 * which is the only place CI state is already fetched for a PR. */
export const completionGate = (
  plan: PlanEntry,
  ciGreen: boolean | null | undefined,
): CompletionGateResult => {
  const missing: string[] = [];
  if (!(plan.phases.length > 0 && plan.phases.every((p) => p.done))) missing.push('open phases');
  if (!(plan.fixes ?? []).every((f) => f.done)) missing.push('open fixes');
  // A PR must exist to merge, but it need not be approved: clicking Complete is the
  // approval. Requiring one would send you to GitHub to approve, where you could just
  // merge — leaving the button with nothing to offer. GitHub agrees: main requires the
  // Quality/Tests/Consistency checks, no approving review.
  if (!plan.pr) missing.push('an open PR');
  // Requested changes are different from an absent review: a reviewer looked and said
  // no. Findings usually land as fixes, which the gate above catches, but not always —
  // so an unanswered change request blocks on its own.
  else if (plan.pr.reviewDecision === 'changes-requested') missing.push('requested changes');
  if (ciGreen !== true) missing.push('CI');
  return { ready: missing.length === 0, missing };
};

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

const PURPOSE_LINE_MAX_LENGTH = 160;

const hasLetters = (value: string): boolean => /[a-zA-Z]/.test(value);

/** The worklist row's "what you get" line (IDEA-180): the body's own opening
 * sentence, trimmed to one line. Punctuation only ends a sentence when followed
 * by whitespace or the end of the text, so a dotted token like `plan-list-
 * selector.ts` doesn't cut the line short. Returns '' when the body has no
 * usable opening sentence — empty, a bare heading marker, or punctuation/symbols
 * with no words — so callers can skip rendering the line entirely. A sentence
 * with no terminal punctuation (so the whole body would otherwise stand in for
 * it) is capped rather than dumped in full. */
export const derivePurposeLine = (body: string): string => {
  const normalized = body
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized || !hasLetters(normalized)) return '';
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (match ? match[0] : normalized).trim();
  if (!hasLetters(sentence)) return '';
  if (sentence.length <= PURPOSE_LINE_MAX_LENGTH) return sentence;
  return `${sentence.slice(0, PURPOSE_LINE_MAX_LENGTH).trimEnd()}…`;
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
