import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AgentId,
  type DefaultAgentsMap,
  type DeskConfig,
  type PaperCampConfig,
  coerceDefaultAgents,
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
    defaultAgents: coerceDefaultAgents(raw?.defaultAgents, raw?.defaultAgent),
    desk: deskResult?.success ? deskResult.data : undefined,
    subjects: readSubjects(root),
  };
}

const DEFAULT_ASSET_MAX_FILE_SIZE_MB = 5;

export function assetMaxFileSizeMb(root: string): number {
  return readProjectConfig(root).raw?.assets?.maxFileSizeMb ?? DEFAULT_ASSET_MAX_FILE_SIZE_MB;
}

export function assetMaxBytes(root: string): number {
  return assetMaxFileSizeMb(root) * 1024 * 1024;
}
