import { AGENT_OPTIONS } from '@/types/index';
import type {
  AgentId,
  AgentOptionsDescriptor,
  AgentRunOptions,
  DefaultAgentsMap,
  TaskKind,
} from '@/types/index';
import * as claudeCode from './claude-code';
import type { ParsedAgentLine } from './claude-code';
import * as opencode from './opencode';

export interface AgentAdapter {
  command: string;
  buildArgs: (prompt: string, opts?: AgentRunOptions) => string[];
  parseLine: (line: string) => ParsedAgentLine | null;
  options: AgentOptionsDescriptor;
}

const DEFAULT_AGENT_ID: AgentId = 'claude-code';

export const AGENTS: Record<AgentId, AgentAdapter> = {
  'claude-code': {
    command: 'claude',
    buildArgs: claudeCode.buildArgs,
    parseLine: claudeCode.parseLine,
    options: AGENT_OPTIONS['claude-code'],
  },
  opencode: {
    command: 'opencode',
    buildArgs: opencode.buildArgs,
    parseLine: opencode.parseLine,
    options: AGENT_OPTIONS.opencode,
  },
};

const TASK_KIND_TO_DEFAULT_KEY: Record<TaskKind, keyof DefaultAgentsMap> = {
  phase: 'phase',
  audit: 'phase',
  'batch-reconcile': 'phase',
  'run-all': 'phase',
  sync: 'phase',
  reconcile: 'phase',
  'fix-review': 'phase',
  // Rework writes new phases from prose notes — the same authoring job as drafting.
  rework: 'planDraft',
  draft: 'planDraft',
  extend: 'ideaExtend',
  suggest: 'ideaExtend',
  'commit-suggest': 'commitSuggest',
  'overlap-check': 'commitSuggest',
  prioritise: 'commitSuggest',
  // Also authors phase/idea text from prose, same bucket as rework/draft.
  'review-split': 'planDraft',
  // Replies conversationally from prose context, same authoring bucket as review-split.
  feedback: 'planDraft',
};

export function resolveAgent(opts: {
  agentId?: AgentId;
  defaultAgents?: DefaultAgentsMap;
  taskKind?: TaskKind;
}): { id: AgentId; adapter: AgentAdapter } & AgentRunOptions {
  const { agentId, defaultAgents, taskKind } = opts;
  if (agentId && agentId in AGENTS) return { id: agentId, adapter: AGENTS[agentId] };
  if (taskKind && defaultAgents) {
    const key = TASK_KIND_TO_DEFAULT_KEY[taskKind];
    const fallback = defaultAgents[key];
    if (fallback) {
      const id = fallback.agent;
      if (id in AGENTS) {
        return { id, adapter: AGENTS[id], model: fallback.model, effort: fallback.effort };
      }
    }
  }
  return { id: DEFAULT_AGENT_ID, adapter: AGENTS[DEFAULT_AGENT_ID] };
}
