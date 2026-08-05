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

export interface PhaseItem {
  done: boolean;
  text: string;
  description?: string;
  source?: 'review';
}

/** A body section anchor is `body` for now — the whole prose block is the only
 * body section a plan/entity has until later phases break it into sub-sections. */
export type MarginNoteAnchor = { kind: 'phase'; index: number } | { kind: 'body' };

export type MarginNoteState = 'open' | 'resolved';

export type MarginNoteKind = 'note' | 'decision' | 'question';

export interface MarginNote {
  anchor: MarginNoteAnchor;
  prose: string;
  state: MarginNoteState;
  kind?: MarginNoteKind;
}

/** What a thread message originally was, before log/review/notes/clarifications folded
 * into one ordered thread on the entity — 'note'/'decision'/'question' carry `state`,
 * the rest are plain historical records. 'chat' is thread-native (no legacy section):
 * Paper Scout conversation, collapsed by default in thread views. */
export type ThreadMessageKind =
  | 'log'
  | 'clarification'
  | 'review'
  | 'note'
  | 'decision'
  | 'question'
  | 'chat';

export interface ThreadMessage {
  kind: ThreadMessageKind;
  /** Absent for messages ported from the old Notes section, which never carried a date. */
  date?: string;
  text: string;
  /** Only meaningful for note/decision/question kinds. */
  state?: MarginNoteState;
  /** Absent means 'user' — no thread message predates this field being agent-authored. */
  from?: 'user' | 'agent';
}

/** Ambient context a chat mount (desk, toolbar) feeds alongside a message — each
 * mount populates whatever it has (IDEA-130); Scout folds it into the prompt
 * silently, it never becomes a user-visible field. */
export interface MountContext {
  route?: string;
  focusedIdeaId?: string;
  viewport?: { width: number; height: number };
}

export interface RawEntry {
  title: string;
  fields: Record<string, string>;
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  notes?: MarginNote[];
  review?: LogEntry[];
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

export interface FeedbackPhaseEdit {
  op: 'add' | 'reword';
  /** 1-based position in the plan's current phase list; required for "reword", ignored for "add". */
  index?: number;
  text: string;
  description?: string;
}

export interface FeedbackEdit {
  phases?: FeedbackPhaseEdit[];
  /** The complete replacement body, when the message corrects body prose. */
  body?: string;
}

// Parsed from the JSON object a feedback-reply agent's prompt requires as its
// final line. The chat never creates ideas — a request is either a reply or an
// edit on the current plan.
export interface FeedbackReplyResult {
  reply: string;
  edit?: FeedbackEdit;
  /** True when the user's message answers an open question the agent asked
   * earlier in this thread — the route persists that message as a clarification. */
  answersQuestion?: boolean;
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
  /** Post-build findings, same checkbox grammar as `phases` — see EntityEntry.fixes. */
  fixes?: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
  notes?: MarginNote[];
  /** Prose written against the whole finished plan, distinct from the flat `log` — an
   * agent later splits each entry into rework phases or a follow-up idea. */
  review?: LogEntry[];
  /** The entity's single ordered feedback thread — see EntityEntry.thread. */
  thread?: ThreadMessage[];
  /** Set by readEntities from which dir the file came from — see EntityEntry.archived. */
  archived?: boolean;
  pr?: PrInfo;
}

export interface ArchivableIdea {
  id: string;
  title: string;
  pr: PrInfo;
}

export type ConsistencyIssueKind = 'orphan-subject';

export interface ConsistencyIssue {
  kind: ConsistencyIssueKind;
  section: 'plans';
  title: string;
  message: string;
  planId?: string;
}

export interface CommentStats {
  commentLines: number;
  sourceLines: number;
  ratio: number;
}

export interface TasksPerWeek {
  /** ISO week, e.g. "2026-W05". */
  week: string;
  count: number;
}

export interface ProjectStats {
  generatedAt: string;
  comments: CommentStats;
  testLines: number;
  /** Null when no coverage report has been emitted yet (run `pnpm test`). */
  testCoveragePct: number | null;
  entitiesByStatus: Partial<Record<EntityStatus, number>>;
  openQuestions: number;
  decisions: number;
  tasksPerWeek: TasksPerWeek[];
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
  /** Version tag (e.g. v0.13.1) that first shipped this idea, stamped from the release train. */
  released?: string;
  tags: string[];
  /** Absent renders as the virtual "No subject" group. */
  subject?: string;
  /** Absent means unordered — sorts after all ordered entries, by created date. */
  order?: number;
  body: string;
  phases: PhaseItem[];
  /** Post-build findings, same checkbox grammar as `phases` — appended below Phases
   * rather than rewriting the plan's already-finished phase history. */
  fixes?: PhaseItem[];
  /** The entity's single ordered feedback thread — folds what used to be separate
   * log/clarifications/notes/review sections. */
  thread?: ThreadMessage[];
  /** Set by readEntities from which of the two scanned dirs the file came from, not the frontmatter. */
  archived?: boolean;
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
  linked: string[];
}

export interface RoadmapHorizon {
  title: string;
  items: RoadmapItem[];
}

export interface Roadmap {
  goal: string;
  horizons: RoadmapHorizon[];
  standingConcerns: RoadmapItem[];
}

export interface RoadmapLink {
  id: string;
  status: PlanStatus;
  taskRuns: number;
  pr?: PrInfo;
  released: boolean;
}

export interface RoadmapRollup {
  total: number;
  done: number;
}

export interface ResolvedRoadmapItem extends RoadmapItem {
  links: RoadmapLink[];
  rollup: RoadmapRollup;
}

export interface ResolvedRoadmapHorizon {
  title: string;
  items: ResolvedRoadmapItem[];
  rollup: RoadmapRollup;
}

export interface ResolvedRoadmap {
  goal: string;
  horizons: ResolvedRoadmapHorizon[];
  events: RoadmapEvent[];
}

export type RoadmapEventKind = 'created' | 'task-run';

export interface RoadmapEvent {
  date: string;
  kind: RoadmapEventKind;
  entityId: string;
  horizonTitle: string;
  itemName: string;
  label: string;
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
  /** Prior claude-code session id to continue instead of starting cold; ignored by opencode. */
  resume?: string;
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
  feedback: AgentConfig;
}

export const DEFAULT_AGENTS: DefaultAgentsMap = {
  phase: { agent: 'opencode' },
  planDraft: { agent: 'claude-code' },
  ideaExtend: { agent: 'claude-code' },
  commitSuggest: { agent: 'claude-code' },
  feedback: { agent: 'claude-code', model: 'sonnet', effort: 'medium' },
};

/** Toolbar segments, left to right (IDEA-128); trimmed per project via `IntegrationConfig.toolbar.segments`. */
export const TOOLBAR_SEGMENT_IDS = ['focus', 'scout', 'runs', 'ship', 'desk'] as const;

export type ToolbarSegmentId = (typeof TOOLBAR_SEGMENT_IDS)[number];

export interface IntegrationToolbarConfig {
  enabled?: boolean;
  segments?: ToolbarSegmentId[];
  /** Opt-in escape hatch: without it, the vite plugin stays off when `mode` is `production`. */
  allowProduction?: boolean;
}

export interface IntegrationConfig {
  toolbar?: IntegrationToolbarConfig;
  route?: string;
}

export interface PaperCampConfig {
  version: string;
  projectName: string;
  initializedAt: string;
  /** The unified-entity `idea` counter; the per-kind plan counters are legacy, present only in pre-migration configs. */
  nextId?: Partial<Record<PlanKind, number>> & { idea?: number };
  port?: number;
  defaultAgents?: DefaultAgentsMap;
  /** Derived from `ROADMAP.md` on every read (IDEA-95), never written to disk; an idea's
   * `subject` not present here renders as "No subject". */
  subjects?: string[];
  /** Opts out of the first-run redirect to Settings > Setup while capabilities are incomplete. */
  setupDismissed?: boolean;
  /** In-app dev toolbar (IDEA-128) — the `@dendelion/paper-camp/vite` plugin's mount, toggleable for frontend targets. */
  integration?: IntegrationConfig;
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

export interface AgentAuthStatus {
  loggedIn: boolean | null;
  authMethod: string | null;
  apiProvider: string | null;
}

export type LoginRelayPhase =
  | 'starting'
  | 'awaiting-authorization'
  | 'success'
  | 'error'
  | 'cancelled';

export interface LoginRelayState {
  phase: LoginRelayPhase;
  authorizeUrl: string | null;
  error?: string;
}

export type ServiceId = 'git' | 'gh' | `agent:${AgentId}`;

/** What a Connections row offers once its service isn't `ok` — copy a command, follow a link, or read plain instructions. */
export type ConnectAction =
  /** `runnable` marks a command with no placeholders and no interactive prompts — safe for the server to execute directly instead of just displaying it. */
  | { kind: 'command'; command: string; runnable?: boolean }
  | { kind: 'link'; url: string; label: string }
  | { kind: 'text'; message: string };

export interface ConnectionResult {
  id: ServiceId;
  label: string;
  unlocks: string;
  status: CapabilityStatus;
  detail: string;
  authenticated: boolean | null;
  connect: ConnectAction | null;
}

export interface MergePolicy {
  allowSquashMerge: boolean;
  allowMergeCommit: boolean;
  allowRebaseMerge: boolean;
  squashMergeCommitTitle: string;
  squashMergeCommitMessage: string;
}

export type MergePolicyResult =
  | { status: 'ok'; repo: string; policy: MergePolicy }
  | { status: 'unavailable'; reason: string };

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
  behind: number;
  diverged: boolean;
  branchHygiene: BranchHygieneStatus;
}

export interface FileDiffEntry {
  path: string;
  renameSource?: string;
  staged: boolean;
  binary: boolean;
  additions: number;
  deletions: number;
  // 'diff' is a unified patch (tracked files); 'raw' is untracked file content, not a
  // patch; 'too-large' means `patch` is empty and the file was skipped.
  contentKind: 'diff' | 'raw' | 'too-large';
  patch: string;
}

export type BranchHygieneStatus =
  | 'clean-on-main'
  | 'stale-merged'
  | 'stale-no-upstream'
  | 'dirty'
  | 'fine';

export interface GitLiveState {
  branch: string;
  ahead: number;
  behind: number;
  dirtyCount: number;
}

export interface GitSyncFailure {
  ok: false;
  stage: 'reconcile' | 'stash-pop' | 'conflicted';
  message: string;
  stashPending: boolean;
  // Only set when stage is 'conflicted': the files a rebase left with unresolved
  // markers, for a one-click "ask the agent to resolve" rather than a bare error.
  conflictedFiles?: string[];
  // Only set when stage is 'conflicted': the ref the rebase targeted, and each
  // conflicted file's last-seen content (with markers) before the rebase was
  // aborted for safety — the resolve-conflict agent's raw material.
  conflictRef?: string;
  conflictedContent?: { path: string; content: string }[];
  // Prompt for the agent recovery job (see git-sync-recovery.ts) — the deterministic
  // path's failure, the working-tree state, and the goal, packaged for a future
  // launch rather than thrown at the user.
  recoveryPrompt: string;
  // Only set when stage is 'conflicted': a prompt scoped to landing this one rebase
  // (see resolve-conflict-prompt.ts) — launched only on explicit "ask the agent to
  // resolve" confirmation from the sync-failed toast, never automatically.
  conflictPrompt?: string;
}

export type GitSyncResult = { ok: true } | GitSyncFailure;

export type AgentTaskStatus = 'starting' | 'running' | 'stopping' | 'done' | 'error' | 'superseded';

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
  | 'fix-review'
  | 'resolve-conflict'
  | 'feedback';

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
  outcome: 'done' | 'error' | 'superseded';
  reason?: string;
}

export interface TrailHop<T> {
  reached: boolean;
  data?: T;
}

export interface ProvenanceTrail {
  id: string;
  idea: TrailHop<{ title: string; status?: EntityStatus; type?: EntityType }>;
  phases: TrailHop<PhaseItem[]>;
  taskRuns: TrailHop<TaskLogEntry[]>;
  commits: TrailHop<string[]>;
  pr: TrailHop<PrInfo>;
  releaseLine: TrailHop<string>;
}

export interface AgentTaskState {
  id: string;
  status: AgentTaskStatus;
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  phaseIndex?: number;
  fixAttempt?: number;
  fixAttemptCap?: number;
  ideaId?: string;
  agentId: AgentId;
  lines: string[];
  // fix-review only: prefills the commit form once the agent has reported.
  suggestedCommit?: { title: string; message: string };
  errorKind?: 'auth' | 'question';
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
