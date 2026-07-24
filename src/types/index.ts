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

// Per-comment detail; PrInfo.unresolvedThreadCount only counts these.
export interface ReviewThread {
  /** GraphQL node id — what `resolveReviewThread`/`replyToReviewThread` address. */
  id: string;
  /** File path the comment is anchored to; absent for a PR-level (not diff-anchored) comment. */
  path?: string;
  line?: number;
  author?: string;
  body: string;
}

// Parsed from the JSON object a fix-review agent's prompt requires as its final line.
export interface FixReviewResult {
  commit: { title: string; message: string };
  addressed: string[];
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
  /** Absent renders under the virtual "No subject" group. */
  subject?: string;
  /** Absent means unordered — sorts after all ordered entries, by created date. */
  order?: number;
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  pr?: PrInfo;
}

export interface ArchivableIdea {
  id: string;
  title: string;
  pr: PrInfo;
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
  /** Absent renders under the virtual "No subject" group. */
  subject?: string;
  /** Absent means unordered — sorts after all ordered entries, by created date. */
  order?: number;
  /** Fallback sort key for unordered entries — see `order`. Absent on view-model-only IdeaEntry literals that never enter the worklist sort. */
  created?: string;
  log?: LogEntry[];
}

// Unified entity — one file per entity, plan as an optional Phases section.
// Supersedes PlanEntry/IdeaEntry once the migration cutover lands.

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
  /** Absent renders as the virtual "No subject" group. */
  subject?: string;
  /** Absent means unordered — sorts after all ordered entries, by created date. */
  order?: number;
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  /** Set by readEntities from which of the two scanned dirs the file came from, not the frontmatter. */
  archived?: boolean;
}

export interface ProgressEntry {
  date: string;
  items: string[];
}

// No `id`/`status`: it only becomes a real idea if a human promotes it.
export interface SuggestionEntry {
  date: string;
  title: string;
  description: string;
}

export interface RoadmapItem {
  name: string;
  description: string;
  candidates: string[];
}

export interface RoadmapHorizon {
  title: string;
  items: RoadmapItem[];
}

export interface Roadmap {
  goal: string;
  horizons: RoadmapHorizon[];
}

export interface EnvEntry {
  key: string;
  value: string;
  /** Set on GET responses when the value is withheld — secrets never reach the client. */
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
  // A missing key must not throw — that would 500 the /api/config read this protects.
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
  /** The managed subject list; an idea's `subject` not present here renders as "No subject". */
  subjects?: string[];
  /** Opts out of the first-run redirect to Settings > Setup while capabilities are incomplete. */
  setupDismissed?: boolean;
}

export type CheckStatus = 'stale' | 'running' | 'pass' | 'fail';

export interface CheckResult {
  status: CheckStatus;
  lastRun: string | null;
  output: string;
}

export type CheckName = 'lint' | 'format' | 'test' | 'consistency';

export type CapabilityStatus = 'ok' | 'warn' | 'missing';

export interface CapabilityResult {
  id: string;
  status: CapabilityStatus;
  detail: string;
}

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
  | 'prioritise'
  | 'sync'
  | 'reconcile'
  | 'fix-review';

// Persisted to papercamp/tasks.log (JSON Lines) — survives a dev-server restart,
// unlike the in-memory task registry.
export interface TaskLogEntry {
  id: string;
  taskKind: TaskKind;
  planId?: string;
  planTitle: string;
  agentId: AgentId;
  startedAt: string;
  endedAt: string;
  outcome: 'done' | 'error';
}

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
  // fix-review only: prefills the commit form once the agent has reported.
  suggestedCommit?: { title: string; message: string };
}

export interface OverlapVerdict {
  verdict: 'existing' | 'extend' | 'new';
  targetId: string | null;
  reasoning: string;
}

/** `why` carries one line per entry in `order`, same index — the reason for that id's placement. */
export interface PrioritiseVerdict {
  order: string[];
  why: string;
}

export interface ReconcileQueueItem {
  planId: string;
  title: string;
  before: { body: string; phases: PhaseItem[] };
}
