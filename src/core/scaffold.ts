import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PaperCampConfig } from '../types/index';
import { paperCampConfigSchema } from './schemas';
import { CLAUDE_SETTINGS_JSON, SKILL_MD_CONTENT } from './templates';

export const PAPER_CAMP_VERSION = '0.1.0';

export class AlreadyInitializedError extends Error {
  constructor(targetDir: string) {
    super(`Paper Camp is already initialized in ${targetDir} (papercamp/config.json exists).`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const MONOLITHIC_FILES = ['progress.md', 'decisions.md', 'open-questions.md'];

export interface InitOptions {
  projectName: string;
  intent?: string;
}

/**
 * Scaffolds papercamp/config.json and papercamp/ directory structure.
 * Creates per-file plan/idea directories and index files, plus monolithic
 * files for the remaining sections (progress, decisions, open-questions).
 * Never overwrites existing files.
 */
export async function initProject(targetDir: string, options: InitOptions): Promise<void> {
  const campDir = join(targetDir, 'papercamp');
  const configPath = join(campDir, 'config.json');

  if (await exists(configPath)) {
    throw new AlreadyInitializedError(targetDir);
  }

  const config: PaperCampConfig = {
    version: PAPER_CAMP_VERSION,
    projectName: options.projectName,
    initializedAt: new Date().toISOString(),
    nextId: { idea: 1 },
  };
  paperCampConfigSchema.parse(config);

  await mkdir(campDir, { recursive: true });

  const ideasDir = join(campDir, 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const entityArchiveDir = join(ideasDir, 'archive');
  await mkdir(entityArchiveDir, { recursive: true });
  const ideasIndex = join(ideasDir, 'index.md');
  if (!(await exists(ideasIndex))) {
    const ideasBody = options.intent
      ? `# ${options.projectName}\n\n${options.intent}\n`
      : `# ${options.projectName}\n\nWhat are you building, and why?\n`;
    await writeFile(ideasIndex, ideasBody, 'utf-8');
  }

  for (const name of MONOLITHIC_FILES) {
    const filePath = join(campDir, name);
    if (!(await exists(filePath))) {
      await writeFile(filePath, '', 'utf-8');
    }
  }

  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

  await scaffoldClaudeCodeIntegration(targetDir);
}

/**
 * Scaffolds the Claude Code native-integration surfaces: the auto-discovered
 * skill and the SessionStart/PostToolUse hook wiring in `.claude/settings.json`.
 * Each piece follows the same no-clobber contract as the rest of init — an
 * existing file is left untouched rather than merged into.
 */
async function scaffoldClaudeCodeIntegration(targetDir: string): Promise<void> {
  const skillDir = join(targetDir, '.claude', 'skills', 'paper-camp');
  await mkdir(skillDir, { recursive: true });
  const skillPath = join(skillDir, 'SKILL.md');
  if (!(await exists(skillPath))) {
    await writeFile(skillPath, SKILL_MD_CONTENT, 'utf-8');
  }

  const claudeDir = join(targetDir, '.claude');
  await mkdir(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, 'settings.json');
  if (!(await exists(settingsPath))) {
    await writeFile(settingsPath, CLAUDE_SETTINGS_JSON, 'utf-8');
  }
}
