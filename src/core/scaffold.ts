import { access, mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PaperCampConfig } from '../types/index';
import { paperCampConfigSchema } from './schemas';
import { CLAUDE_SETTINGS_JSON, POST_COMMIT_HOOK_SCRIPT, SKILL_MD_CONTENT } from './templates';

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
    nextId: { feat: 1, fix: 1, chore: 1, docs: 1, refactor: 1 },
  };
  paperCampConfigSchema.parse(config);

  await mkdir(campDir, { recursive: true });

  // Per-file plans directory with index and archive
  const plansDir = join(campDir, 'plans');
  await mkdir(plansDir, { recursive: true });
  const plansIndex = join(plansDir, 'index.md');
  if (!(await exists(plansIndex))) {
    await writeFile(plansIndex, '# Plans\n\nNo plans yet.\n', 'utf-8');
  }
  const archiveDir = join(plansDir, 'archive');
  await mkdir(archiveDir, { recursive: true });

  // Per-file ideas directory with index
  const ideasDir = join(campDir, 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const ideasIndex = join(ideasDir, 'index.md');
  if (!(await exists(ideasIndex))) {
    const ideasBody = options.intent
      ? `# ${options.projectName}\n\n${options.intent}\n`
      : `# ${options.projectName}\n\nWhat are you building, and why?\n`;
    await writeFile(ideasIndex, ideasBody, 'utf-8');
  }

  // Monolithic files for the remaining sections
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
 * Scaffolds the four Claude Code native-integration surfaces: the
 * auto-discovered skill, the SessionStart/PostToolUse hook wiring in
 * `.claude/settings.json`, and the git post-commit auto-logger. Each piece
 * follows the same no-clobber contract as the rest of init — an existing
 * file is left untouched rather than merged into.
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

  // Only in an actual git repo, and only if no post-commit hook is already installed.
  // A worktree/submodule checkout has `.git` as a FILE ("gitdir: …") rather than a
  // directory, so mkdir(.git/hooks) under it would throw ENOTDIR — require a real
  // directory and skip the native-hook scaffold otherwise.
  const gitDir = join(targetDir, '.git');
  const gitDirStat = await stat(gitDir).catch(() => null);
  if (gitDirStat?.isDirectory()) {
    const hooksDir = join(gitDir, 'hooks');
    const postCommitPath = join(hooksDir, 'post-commit');
    if (!(await exists(postCommitPath))) {
      await mkdir(hooksDir, { recursive: true });
      await writeFile(postCommitPath, POST_COMMIT_HOOK_SCRIPT, { encoding: 'utf-8', mode: 0o755 });
    }
  }
}
