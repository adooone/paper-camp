import type { AgentId, DefaultAgentsMap, TaskKind } from '../../../types/index';
import * as claudeCode from './claude-code';
import type { ParsedAgentLine } from './claude-code';
import * as opencode from './opencode';

export interface AgentAdapter {
  command: string;
  buildArgs: (prompt: string) => string[];
  parseLine: (line: string) => ParsedAgentLine | null;
}

export const DEFAULT_AGENT_ID: AgentId = 'claude-code';

export const AGENTS: Record<AgentId, AgentAdapter> = {
  'claude-code': {
    command: 'claude',
    buildArgs: claudeCode.buildArgs,
    parseLine: claudeCode.parseLine,
  },
  opencode: {
    command: 'opencode',
    buildArgs: opencode.buildArgs,
    parseLine: opencode.parseLine,
  },
};

const TASK_KIND_TO_DEFAULT_KEY: Record<TaskKind, keyof DefaultAgentsMap> = {
  phase: 'phase',
  audit: 'phase',
  draft: 'planDraft',
  extend: 'ideaExtend',
  'commit-suggest': 'commitSuggest',
};

export function resolveAgent(opts: {
  agentId?: AgentId;
  defaultAgents?: DefaultAgentsMap;
  taskKind?: TaskKind;
}): { id: AgentId; adapter: AgentAdapter } {
  const { agentId, defaultAgents, taskKind } = opts;
  if (agentId && agentId in AGENTS) return { id: agentId, adapter: AGENTS[agentId] };
  if (taskKind && defaultAgents) {
    const key = TASK_KIND_TO_DEFAULT_KEY[taskKind];
    const fallback = defaultAgents[key];
    if (fallback && fallback in AGENTS) return { id: fallback, adapter: AGENTS[fallback] };
  }
  return { id: DEFAULT_AGENT_ID, adapter: AGENTS[DEFAULT_AGENT_ID] };
}
