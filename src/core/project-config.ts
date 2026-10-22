import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AgentId,
  DEFAULT_AGENTS,
  type DefaultAgentsMap,
  type DeskConfig,
  type PaperCampConfig,
  coerceAgentConfig,
} from '../types/index';
import { deskConfigSchema } from './parse';
import { deriveSubjectVocabulary, parseRoadmap } from './roadmap';

export interface ProjectConfig {
  /** `null` when `papercamp/config.json` is missing or unparsable. */
  raw: (PaperCampConfig & { defaultAgent?: AgentId }) | null;
  defaultAgents: DefaultAgentsMap;
  desk: DeskConfig | undefined;
  subjects: string[];
}

function coerceDefaultAgents(
  config: (PaperCampConfig & { defaultAgent?: AgentId }) | null,
): DefaultAgentsMap {
  const rawAgents = config?.defaultAgents as Record<string, unknown> | undefined;
  if (rawAgents) {
    return {
      phase: coerceAgentConfig(rawAgents.phase),
      planDraft: coerceAgentConfig(rawAgents.planDraft),
      ideaExtend: coerceAgentConfig(rawAgents.ideaExtend),
      commitSuggest: coerceAgentConfig(rawAgents.commitSuggest),
      // Older configs predate this bucket — default it to sonnet/medium rather
      // than the bare-claude-code fallback coerceAgentConfig(undefined) gives.
      feedback: rawAgents.feedback
        ? coerceAgentConfig(rawAgents.feedback)
        : DEFAULT_AGENTS.feedback,
      codeReview: rawAgents.codeReview
        ? coerceAgentConfig(rawAgents.codeReview)
        : DEFAULT_AGENTS.codeReview,
      deskDiscovery: rawAgents.deskDiscovery
        ? coerceAgentConfig(rawAgents.deskDiscovery)
        : DEFAULT_AGENTS.deskDiscovery,
      nightShift: rawAgents.nightShift
        ? coerceAgentConfig(rawAgents.nightShift)
        : DEFAULT_AGENTS.nightShift,
    };
  }
  // old config.json files predate FEAT-26's per-task buckets and only carry one
  // agent id for everything.
  if (config?.defaultAgent) {
    const id = config.defaultAgent;
    return {
      phase: { agent: id },
      planDraft: { agent: id },
      ideaExtend: { agent: id },
      commitSuggest: { agent: id },
      feedback: { agent: id },
      codeReview: { agent: id },
      deskDiscovery: { agent: id },
      nightShift: { agent: id },
    };
  }
  return DEFAULT_AGENTS;
}

function readSubjects(root: string): string[] {
  try {
    const raw = readFileSync(join(root, 'ROADMAP.md'), 'utf-8');
    return deriveSubjectVocabulary(parseRoadmap(raw));
  } catch {
    return [];
  }
}

/** The single reader for `papercamp/config.json` — parses and coerces default
 *  agents, the desk manifest, and the roadmap-derived subject vocabulary once. */
export function readProjectConfig(root: string): ProjectConfig {
  let raw: (PaperCampConfig & { defaultAgent?: AgentId }) | null = null;
  try {
    raw = JSON.parse(readFileSync(join(root, 'papercamp', 'config.json'), 'utf-8'));
  } catch {
    raw = null;
  }
  // A malformed desk manifest (IDEA-119) is dropped rather than crashing the page.
  const deskResult = raw?.desk !== undefined ? deskConfigSchema.safeParse(raw.desk) : undefined;
  return {
    raw,
    defaultAgents: coerceDefaultAgents(raw),
    desk: deskResult?.success ? deskResult.data : undefined,
    subjects: readSubjects(root),
  };
}
