import { existsSync, readFileSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaperCampConfig } from '../../types/index';
import { CORPUS_FORMAT_VERSION } from '../corpus-format';
import { addProject, defaultRegistryPath, loadRegistry, saveRegistry } from '../machine-registry';
import { paperCampConfigSchema } from '../parse/schemas';
import { formatEntityFile, todayDateString } from '../serialize';
import { CLAUDE_SETTINGS_JSON, SKILL_MD_CONTENT } from './templates';

const PACKAGE_JSON_SEARCH_DEPTH = 5;

// Walks up from this module's own location rather than a fixed relative path, so it
// survives both the bundled build and running from raw source at different directory depths.
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

  await ensureGitignoreEntry(targetDir);

  await scaffoldClaudeCodeIntegration(targetDir);

  await registerInMachineRegistry(targetDir, options.projectName);
}

// addProject dedupes by resolved absolute path, so registering an already-registered
// path (e.g. re-init after the registry entry was removed by hand) is a no-op, not a duplicate.
async function registerInMachineRegistry(targetDir: string, projectName: string): Promise<void> {
  const registryPath = defaultRegistryPath();
  const registry = await loadRegistry(registryPath);
  const { registry: updated, created } = addProject(registry, targetDir, projectName);
  if (created) {
    await saveRegistry(registryPath, updated);
  }
}

const PAIRING_GITIGNORE_ENTRY = 'papercamp/.pairing.json';

// Machine-local pairing state must never be tracked — a token committed to the
// repo would let anyone with read access pair as a trusted hosted client.
async function ensureGitignoreEntry(targetDir: string): Promise<void> {
  const gitignorePath = join(targetDir, '.gitignore');
  const content = (await exists(gitignorePath)) ? await readFile(gitignorePath, 'utf-8') : '';
  const lines = content.length > 0 ? content.split('\n') : [];
  if (lines.some((line) => line.trim() === PAIRING_GITIGNORE_ENTRY)) return;

  const lastPapercampLine = lines.reduce(
    (last, line, i) => (line.startsWith('papercamp/') ? i : last),
    -1,
  );
  if (lastPapercampLine === -1) {
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await writeFile(gitignorePath, `${content}${separator}${PAIRING_GITIGNORE_ENTRY}\n`, 'utf-8');
    return;
  }
  lines.splice(lastPapercampLine + 1, 0, PAIRING_GITIGNORE_ENTRY);
  await writeFile(gitignorePath, lines.join('\n'), 'utf-8');
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
