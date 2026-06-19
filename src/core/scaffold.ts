import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PaperCampConfig } from '../types/index';
import { paperCampConfigSchema } from './schemas';

export const PAPER_CAMP_VERSION = '0.1.0';

export class AlreadyInitializedError extends Error {
  constructor(targetDir: string) {
    super(`Paper Camp is already initialized in ${targetDir} (.paper-camp/config.json exists).`);
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

const SKELETON_FILES = ['plans.md', 'progress.md', 'decisions.md', 'open-questions.md'];

export interface InitOptions {
  projectName: string;
  intent?: string;
}

/**
 * Scaffolds .paper-camp/config.json and papercamp/*.md. Never overwrites existing
 * files — a project's memory is never something `init` should clobber.
 */
export async function initProject(targetDir: string, options: InitOptions): Promise<void> {
  const configDir = join(targetDir, '.paper-camp');
  const configPath = join(configDir, 'config.json');
  const campDir = join(targetDir, 'papercamp');

  if (await exists(configPath)) {
    throw new AlreadyInitializedError(targetDir);
  }

  const config: PaperCampConfig = {
    version: PAPER_CAMP_VERSION,
    projectName: options.projectName,
    initializedAt: new Date().toISOString(),
  };
  paperCampConfigSchema.parse(config);

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');

  await mkdir(campDir, { recursive: true });

  const ideasPath = join(campDir, 'ideas.md');
  if (!(await exists(ideasPath))) {
    const ideasBody = options.intent
      ? `# ${options.projectName}\n\n${options.intent}\n`
      : `# ${options.projectName}\n\nWhat are you building, and why?\n`;
    await writeFile(ideasPath, ideasBody, 'utf-8');
  }

  for (const name of SKELETON_FILES) {
    const filePath = join(campDir, name);
    if (!(await exists(filePath))) {
      await writeFile(filePath, '', 'utf-8');
    }
  }
}
