export type PlanStatus = 'idea' | 'planned' | 'in-progress' | 'review' | 'done' | 'dropped';

export const PLAN_STATUSES: PlanStatus[] = [
  'idea',
  'planned',
  'in-progress',
  'review',
  'done',
  'dropped',
];

export interface LogEntry {
  date: string;
  text: string;
}

export type PlanKind = 'feat' | 'fix' | 'chore' | 'docs' | 'refactor';

export const PLAN_KINDS: PlanKind[] = ['feat', 'fix', 'chore', 'docs', 'refactor'];

export const AGENT_IDS = ['claude-code', 'opencode'] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export const AGENT_LABELS: Record<AgentId, string> = {
  'claude-code': 'Claude Code',
  opencode: 'OpenCode',
};

export type DecisionStatus = 'decided' | 'superseded';

export type QuestionStatus = 'open' | 'resolved';

export interface PhaseItem {
  done: boolean;
  text: string;
  description?: string;
  source?: 'review';
}

/** Raw shape produced by the generic heading-block parser, before per-file validation. */
export interface RawEntry {
  title: string;
  fields: Record<string, string>;
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
}

export interface ParseWarning {
  title: string;
  message: string;
}

export interface ParseResult<T> {
  entries: T[];
  warnings: ParseWarning[];
}

/** A PR's reviewable/mergeable state, as surfaced by `gh pr list`. */
export type PrState = 'draft' | 'open' | 'closed' | 'merged';

/** GitHub's PR review decision, as surfaced by `gh pr list --json reviewDecision`. */
export type ReviewDecision = 'approved' | 'changes-requested' | 'review-required';

/**
 * A single unresolved review comment/thread on a PR — the per-comment detail
 * `PrInfo.unresolvedThreadCount` only counts. Fetched by the fix-review launch
 * path (not `core/pr.ts`'s worklist resolver, which only needs the count) and
 * fed to `buildFixReviewPrompt` in `prompts.ts`.
 */
export interface ReviewThread {
  /** GraphQL node id — what `resolveReviewThread`/`replyToReviewThread` address. */
  id: string;
  /** File path the comment is anchored to; absent for a PR-level (not diff-anchored) comment. */
  path?: string;
  line?: number;
  author?: string;
  body: string;
}

/**
 * What a fix-review agent reports back, parsed from the JSON object its prompt
 * requires as its final line. The agent no longer commits — a human does — so
 * this carries the message it proposes plus its per-comment verdicts, which drive
 * which PR threads get resolved (once the fix is pushed) and which get a reply
 * explaining why they were left alone.
 */
export interface FixReviewResult {
  commit: { title: string; message: string };
  /** Thread ids the agent says its changes settle. */
  addressed: string[];
  /** Thread ids it deliberately left alone, each with the reason to post back. */
  skipped: { threadId: string; why: string }[];
}

/** Live-resolved PR info for an entity's branch — see `core/pr.ts`. */
export interface PrInfo {
  number: number;
  url: string;
  state: PrState;
  /** Undefined when no review has been requested/decided, or when unresolved (offline, closed/merged PR). */
  reviewDecision?: ReviewDecision;
  /** Count of unresolved review threads. Only fetched for open/draft PRs; undefined when not fetched or unresolved. */
  unresolvedThreadCount?: number;
  /** Whether a comment or review landed after the PR's last commit — a proxy for "since the last agent pass" (a pass ends with a push). Only fetched for open/draft PRs. */
  hasNewCommentsSincePush?: boolean;
}

export interface PlanEntry {
  title: string;
  status: PlanStatus;
  kind?: PlanKind;
  id?: string;
  idea?: string;
  agent?: AgentId;
  created: string;
  updated?: string;
  audited?: string;
  auditedHash?: string;
  tags: string[];
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  /** Live-resolved PR for this entity's branch, when one exists — see `core/pr.ts`. */
  pr?: PrInfo;
}

export interface DecisionEntry {
  title: string;
  date: string;
  status: DecisionStatus;
  supersededBy?: string;
  body: string;
}

export interface OpenQuestionEntry {
  title: string;
  status: QuestionStatus;
  raised: string;
  resolvedBy?: string;
  blocks?: string;
  body: string;
}

export type ConsistencyIssueKind =
  | 'dangling-resolved-by'
  | 'dangling-superseded-by'
  | 'blocked-plan-active';

export interface ConsistencyIssue {
  kind: ConsistencyIssueKind;
  section: 'decisions' | 'open-questions';
  title: string;
  message: string;
  planId?: string;
}

export type IdeaKind = 'idea' | 'note';

export type IdeaStatus = 'open' | 'done' | 'dropped';

export interface IdeaEntry {
  id: string | null;
  title: string;
  body: string;
  kind?: IdeaKind;
  status?: IdeaStatus;
  log?: LogEntry[];
}

// ---------------------------------------------------------------------------
// Unified entity  (FEAT-42 phases 7+ — one file per entity: an "idea" for its
// whole life, plan as an optional Phases section. Replaces PlanEntry/IdeaEntry
// once the migration cutover lands.)
// ---------------------------------------------------------------------------

/** Work classification — same Conventional-Commits values as PlanKind; `kind` renamed to `type` in the unified schema. */
export type EntityType = PlanKind;

/** Plan lifecycle plus the note-only `open`. Notes use open → done/dropped; everything else uses the PlanStatus track. */
export type EntityStatus = PlanStatus | 'open';

export interface EntityEntry {
  id: string;
  title: string;
  /** Absent until the entity is classified (usually when its plan is drafted). */
  type?: EntityType;
  /** "note" marks an entity that never grows phases. */
  kind?: 'note';
  /** Stored override, not the source of truth — see entityFrontmatterSchema. */
  status?: EntityStatus;
  agent?: AgentId;
  created: string;
  updated?: string;
  audited?: string;
  auditedHash?: string;
  tags: string[];
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
}

export interface ProgressEntry {
  date: string;
  items: string[];
}

/**
 * A single line in `papercamp/suggestions.md` — an agent's disposable "you
 * might want to do X" hunch. No `id`, no `status`: it only becomes a real
 * idea if a human promotes it (see IDEA-62).
 */
export interface SuggestionEntry {
  date: string;
  title: string;
  description: string;
}

export interface EnvEntry {
  key: string;
  value: string;
  /** Set on GET responses: the key exists in .env but its value is withheld
   *  (secrets are never sent to the client). Absent when writing. */
  isSet?: boolean;
}

export interface AgentConfig {
  agent: AgentId;
  model?: string;
  effort?: string;
}

/** Model/effort passed to an adapter's buildArgs — the AgentConfig minus the agent id. */
export interface AgentRunOptions {
  model?: string;
  effort?: string;
}

/** Maps option names to a fixed value list (renders a Select) or null (free-text or hidden). */
export type AgentOptionsDescriptor = Record<string, string[] | null | undefined>;

export const AGENT_OPTIONS: Record<AgentId, AgentOptionsDescriptor> = {
  'claude-code': {
    model: ['opus', 'sonnet', 'fable', 'haiku'],
    effort: ['low', 'medium', 'high', 'xhigh', 'max'],
  },
  opencode: {
    model: null,
  },
};

export function coerceAgentConfig(v: unknown): AgentConfig {
  const toAgent = (a: unknown): AgentId =>
    AGENT_IDS.includes(a as AgentId) ? (a as AgentId) : 'claude-code';
  if (typeof v === 'string') return { agent: toAgent(v) };
  // Tolerate null/undefined and partial legacy entries — a missing key must not
  // throw (that would 500 the /api/config read this coercion exists to protect).
  const obj = (v ?? {}) as Record<string, unknown>;
  return {
    agent: toAgent(obj.agent),
    ...(typeof obj.model === 'string' && { model: obj.model }),
    ...(typeof obj.effort === 'string' && { effort: obj.effort }),
  };
}

export interface DefaultAgentsMap {
  phase: AgentConfig;
  planDraft: AgentConfig;
  ideaExtend: AgentConfig;
  commitSuggest: AgentConfig;
}

export const DEFAULT_AGENTS: DefaultAgentsMap = {
  phase: { agent: 'opencode' },
  planDraft: { agent: 'claude-code' },
  ideaExtend: { agent: 'claude-code' },
  commitSuggest: { agent: 'claude-code' },
};

export interface PaperCampConfig {
  version: string;
  projectName: string;
  initializedAt: string;
  /** The unified-entity `idea` counter; the per-kind plan counters are legacy, present only in pre-migration configs. */
  nextId?: Partial<Record<PlanKind, number>> & { idea?: number };
  port?: number;
  defaultAgents?: DefaultAgentsMap;
  /** Off by default. When true, the PostToolUse hook logs new-file creations to progress.md. */
  autoLogNewFiles?: boolean;
}

export type CheckStatus = 'stale' | 'running' | 'pass' | 'fail';

export interface CheckResult {
  status: CheckStatus;
  lastRun: string | null;
  output: string;
}

export type CheckName = 'lint' | 'format' | 'test' | 'consistency';

export interface GitStatusEntry {
  path: string;
  status: string;
  staged: boolean;
  renameSource?: string;
}

export interface GitStatusResponse {
  branch: string;
  entries: GitStatusEntry[];
  ahead: number;
  branchHygiene: BranchHygieneStatus;
}

export type BranchHygieneStatus =
  | 'clean-on-main'
  | 'stale-merged'
  | 'stale-no-upstream'
  | 'dirty'
  | 'fine';

export type AgentTaskStatus = 'starting' | 'running' | 'stopping' | 'done' | 'error';

export type TaskKind =
  | 'phase'
  | 'audit'
  | 'batch-reconcile'
  | 'run-all'
  | 'draft'
  | 'extend'
  | 'suggest'
  | 'commit-suggest'
  | 'overlap-check'
  | 'sync'
  | 'reconcile'
  | 'fix-review';

export interface AgentTaskState {
  id: string;
  status: AgentTaskStatus;
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  phaseIndex?: number;
  ideaId?: string;
  agentId: AgentId;
  lines: string[];
  /**
   * fix-review only, once it has reported: the commit message the agent proposes
   * for the work it left uncommitted. The commit form prefills from this — the
   * agent knows the intent behind each fix, which a diff-based suggestion doesn't.
   */
  suggestedCommit?: { title: string; message: string };
}

// The AI Check-overlap action's triage result (IDEA-44 Tier 2): does the typed
// text belong inside an existing idea, extend one, or is it genuinely new?
export interface OverlapVerdict {
  verdict: 'existing' | 'extend' | 'new';
  targetId: string | null;
  reasoning: string;
}

// A single entity's proposed rewrite from a batch reconcile sweep, held server-side
// (see startBatchReconcile in agent.ts) and served via GET /api/agent/reconcile-queue
// once the sweep's `before` snapshot for that entity is known to have changed.
export interface ReconcileQueueItem {
  planId: string;
  title: string;
  before: { body: string; phases: PhaseItem[] };
}
