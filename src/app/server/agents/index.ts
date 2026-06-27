import type { AgentId } from '../../../types/index';
import * as claudeCode from './claude-code';
import type { ParsedAgentLine } from './claude-code';

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
};

export function resolveAgent(agentId: AgentId | undefined): { id: AgentId; adapter: AgentAdapter } {
  const id = agentId && agentId in AGENTS ? agentId : DEFAULT_AGENT_ID;
  return { id, adapter: AGENTS[id] };
}
