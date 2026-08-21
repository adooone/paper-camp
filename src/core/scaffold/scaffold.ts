import { existsSync, readFileSync } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaperCampConfig } from '../../types/index';
import { CORPUS_FORMAT_VERSION } from '../corpus-format';
import { paperCampConfigSchema } from '../parse/schemas';
import { formatEntityFile, todayDateString } from '../serialize';
import { CLAUDE_SETTINGS_JSON, SKILL_MD_CONTENT } from './templates';

const PACKAGE_JSON_SEARCH_DEPTH = 5;

// Read once, from the installed package's own package.json rather than a hand-kept
// constant — this used to drift (stuck at 0.1.0 while releases moved on), which is
// exactly the kind of untrustworthy version report a pinned dev dependency can't
// afford. Walking up from this module's own location (rather than a fixed relative
// path) survives both the bundled build (this file's code lands in dist/cli/index.js
// or dist/core/index.js, two levels down from the package root) and running the raw
// source directly (three levels down) without hardcoding either depth.
function readOwnVersion(): string {
  try {
    let dir = dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < PACKAGE_JSON_SEARCH_DEPTH; i++) {
      const candidate = join(dir, 'package.json');
      if (existsSync(candidate)) {
        const pkg = JSON.parse(readFileSync(candidate, 'utf-8')) as { version?: string };
        return pkg.version ?? '0.0.0';
      }
      dir = dirname(dir);
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const PAPER_CAMP_VERSION = readOwnVersion();

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

const MONOLITHIC_FILES = ['suggestions.md'];

export interface InitOptions {
  projectName: string;
}

export async function initProject(targetDir: string, options: InitOptions): Promise<void> {
  const campDir = join(targetDir, 'papercamp');
  const configPath = join(campDir, 'config.json');

  if (await exists(configPath)) {
    throw new AlreadyInitializedError(targetDir);
  }

  const config: PaperCampConfig = {
    version: CORPUS_FORMAT_VERSION,
    projectName: options.projectName,
    initializedAt: new Date().toISOString(),
    nextId: { idea: 2 },
  };
  paperCampConfigSchema.parse(config);

  await mkdir(campDir, { recursive: true });

  const ideasDir = join(campDir, 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const entityArchiveDir = join(ideasDir, 'archive');
  await mkdir(entityArchiveDir, { recursive: true });
  const exampleIdeaPath = join(ideasDir, 'IDEA-1.md');
  if (!(await exists(exampleIdeaPath))) {
    const exampleIdea = formatEntityFile({
      id: 'IDEA-1',
      title: 'Capture your first idea',
      status: 'idea',
      created: todayDateString(),
      body: "This is an example idea, in the format Paper Camp expects: a short title, a status, and a paragraph of context. Read it, then archive or delete it once you've written your own.\n\nUse the New idea button to capture what you're building next, or ask an agent for suggestions.",
    });
    await writeFile(exampleIdeaPath, `${exampleIdea}\n`, 'utf-8');
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
