import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PaperCampConfig } from '../types/index';
import { paperCampConfigSchema } from './schemas';

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
}
