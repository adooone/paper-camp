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
  tags: string[];
  body: string;
  phases: PhaseItem[];
  log?: LogEntry[];
  clarifications?: LogEntry[];
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

export type IdeaStatus = 'planned' | 'done';

export interface IdeaEntry {
  id: string | null;
  title: string;
  body: string;
  status?: IdeaStatus;
}

export interface ProgressEntry {
  date: string;
  items: string[];
}

export interface EnvEntry {
  key: string;
  value: string;
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
  nextId?: Record<PlanKind, number>;
  port?: number;
  defaultAgents?: DefaultAgentsMap;
}

export type CheckStatus = 'stale' | 'running' | 'pass' | 'fail';

export interface CheckResult {
  status: CheckStatus;
  lastRun: string | null;
  output: string;
}

export type CheckName = 'lint' | 'format' | 'test';

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
  | 'batch-audit'
  | 'run-all'
  | 'draft'
  | 'extend'
  | 'commit-suggest'
  | 'sync'
  | 'reconcile';

export interface AgentTaskState {
  status: AgentTaskStatus;
  taskKind: TaskKind;
  planTitle: string;
  planId?: string;
  phaseIndex?: number;
  ideaId?: string;
  agentId: AgentId;
  lines: string[];
}
