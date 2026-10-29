import { existsSync, readFileSync } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PaperCampConfig } from '../../types/index';
import { CORPUS_FORMAT_VERSION } from '../corpus-format';
import { addProject, defaultRegistryPath, loadRegistry, saveRegistry } from '../machine-registry';
import { paperCampConfigSchema } from '../parse/schemas';
import { formatEntityFile, todayDateString } from '../serialize';
import {
  DRAFT_PR_WORKFLOW_CONTENT,
  DRAFT_PR_WORKFLOW_HEADER,
  PULL_REQUEST_TEMPLATE_CONTENT,
  PULL_REQUEST_TEMPLATE_HEADER,
  SKILL_MD_CONTENT,
  buildClaudeSettingsJson,
  buildMcpJson,
  buildOpencodeJson,
  mergeClaudeSettingsJson,
  mergeMcpJson,
  mergeOpencodeJson,
} from './templates';

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

  await ensureLocalGitignore(campDir);

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

// The pre-IDEA-320 mechanism: lines hand-inserted into the project's own .gitignore,
// one per daemon-written file. Superseded by papercamp/.local/.gitignore, which ignores
// every file under it with a single `*` and needs no list — kept here so the migration
// (IDEA-320 phase 2) can find and drop these lines from projects that still have them.
export const DAEMON_GITIGNORE_ENTRIES = [
  'papercamp/.pairing.json',
  'papercamp/.task-logs/',
  'papercamp/tasks.log',
  'papercamp/notifications.log',
  'papercamp/pr-reviews.json',
  'papercamp/pr-map.json',
  'papercamp/night.json',
  'papercamp/run-order.md',
] as const;

// Ignores the whole folder from inside itself, so nothing written under papercamp/.local/
// can ever be committed regardless of the project's own .gitignore, and git skips the
// folder in `status` — a new local-state file is safe just by living under here.
// Exported so the IDEA-320 migration can create it for a project upgrading from before
// `.local/` existed, not just a fresh `init`.
export async function ensureLocalGitignore(campDir: string): Promise<void> {
  const localDir = join(campDir, '.local');
  await mkdir(localDir, { recursive: true });
  const gitignorePath = join(localDir, '.gitignore');
  if (!(await exists(gitignorePath))) {
    await writeFile(gitignorePath, '*\n', 'utf-8');
  }
}

export async function scaffoldClaudeCodeIntegration(targetDir: string): Promise<void> {
  const skillDir = join(targetDir, '.claude', 'skills', 'paper-camp');
  await mkdir(skillDir, { recursive: true });
  const skillPath = join(skillDir, 'SKILL.md');
  if (!(await exists(skillPath))) {
    await writeFile(skillPath, SKILL_MD_CONTENT, 'utf-8');
  }

  const claudeDir = join(targetDir, '.claude');
  await mkdir(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, 'settings.json');
  if (await exists(settingsPath)) {
    const existing = await readFile(settingsPath, 'utf-8');
    const merged = mergeClaudeSettingsJson(existing, targetDir);
    if (merged !== existing) {
      await writeFile(settingsPath, merged, 'utf-8');
    }
  } else {
    await writeFile(settingsPath, buildClaudeSettingsJson(targetDir), 'utf-8');
  }

  const mcpPath = join(targetDir, '.mcp.json');
  if (await exists(mcpPath)) {
    const existing = await readFile(mcpPath, 'utf-8');
    const merged = mergeMcpJson(existing);
    if (merged !== existing) {
      await writeFile(mcpPath, merged, 'utf-8');
    }
  } else {
    await writeFile(mcpPath, buildMcpJson(), 'utf-8');
  }

  const opencodePath = join(targetDir, 'opencode.json');
  if (await exists(opencodePath)) {
    const existing = await readFile(opencodePath, 'utf-8');
    const merged = mergeOpencodeJson(existing);
    if (merged !== existing) {
      await writeFile(opencodePath, merged, 'utf-8');
    }
  } else {
    await writeFile(opencodePath, buildOpencodeJson(), 'utf-8');
  }
}

// A file without our header is either hand-written or predates this feature — either
// way it's not ours to overwrite, so the switch only ever touches its own copies.
async function writeTemplateIfOwned(path: string, content: string, header: string): Promise<void> {
  if (await exists(path)) {
    const existing = await readFile(path, 'utf-8');
    if (!existing.startsWith(header)) return;
    if (existing === content) return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf-8');
}

export async function scaffoldDraftPrIntegration(targetDir: string): Promise<void> {
  await writeTemplateIfOwned(
    join(targetDir, '.github', 'workflows', 'draft-pr.yml'),
    DRAFT_PR_WORKFLOW_CONTENT,
    DRAFT_PR_WORKFLOW_HEADER,
  );
  await writeTemplateIfOwned(
    join(targetDir, '.github', 'pull_request_template.md'),
    PULL_REQUEST_TEMPLATE_CONTENT,
    PULL_REQUEST_TEMPLATE_HEADER,
  );
}
