import { readFile, readdir, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { PaperCampConfig } from '../../types/index';
import type { LocalStateDrift } from '../corpus';
import { readLocalStateDrift } from '../corpus';
import { assetChecks } from './checks/assets';
import { localStateChecks } from './checks/local-state';
import { metadataChecks } from './checks/metadata';
import { structuralChecks } from './checks/structural';
import { toolingChecks } from './checks/tooling';
import type { DoctorFinding } from './finding';

export interface DoctorEntityFile {
  id: string;
  path: string;
  content: string;
  archived: boolean;
}

export interface DoctorAssetFile {
  name: string;
  size: number;
}

export interface DoctorAssetFolder {
  id: string;
  files: DoctorAssetFile[];
}

export interface DoctorContext {
  files: DoctorEntityFile[];
  config: PaperCampConfig | null;
  hasPermissionsAllow?: boolean;
  hasMcpJsonEntry?: boolean;
  hasOpencodeJsonEntry?: boolean;
  draftPrWorkflowContent?: string | null;
  pullRequestTemplateContent?: string | null;
  localStateDrift?: LocalStateDrift | null;
  assetFolders?: DoctorAssetFolder[];
  assetMaxBytes?: number;
}

export type DoctorCheck = (context: DoctorContext) => DoctorFinding[];

export const DOCTOR_CHECKS: DoctorCheck[] = [
  ...metadataChecks,
  ...structuralChecks,
  ...toolingChecks,
  ...localStateChecks,
  ...assetChecks,
];

const DEFAULT_ASSET_MAX_FILE_SIZE_MB = 5;

// Mirrors core/assets.ts's own folder-per-idea listing, but doctor already loaded
// config.json for other checks, so it reads the folder tree directly rather than
// pulling in that module's project-config dependency a second time.
async function readAssetFolders(paperCampDir: string): Promise<DoctorAssetFolder[]> {
  const assetsDir = join(paperCampDir, 'assets');
  const names = await readdirOptional(assetsDir);
  const folders: DoctorAssetFolder[] = [];
  for (const name of names) {
    const dirPath = join(assetsDir, name);
    const dirStats = await stat(dirPath).catch(() => undefined);
    if (!dirStats || !dirStats.isDirectory()) continue;
    const fileNames = await readdirOptional(dirPath);
    const files: DoctorAssetFile[] = [];
    for (const fileName of fileNames) {
      const fileStats = await stat(join(dirPath, fileName)).catch(() => undefined);
      if (fileStats?.isFile()) files.push({ name: fileName, size: fileStats.size });
    }
    folders.push({ id: name, files });
  }
  return folders;
}

function isEnoent(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === 'ENOENT';
}

// Only a missing directory is benign; any other failure (unreadable dir, permissions)
// must surface rather than masquerade as an empty corpus.
async function readdirOptional(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch (error) {
    if (isEnoent(error)) return [];
    throw error;
  }
}

async function readConfig(configPath: string): Promise<PaperCampConfig | null> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
  try {
    return JSON.parse(raw) as PaperCampConfig;
  } catch {
    return null;
  }
}

async function readHasPermissionsAllow(root: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(join(root, '.claude', 'settings.json'), 'utf-8');
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as { permissions?: { allow?: unknown } };
    return Array.isArray(parsed.permissions?.allow) && parsed.permissions.allow.length > 0;
  } catch {
    return false;
  }
}

async function readHasPaperCampEntry(path: string, key: string): Promise<boolean> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if (isEnoent(error)) return false;
    throw error;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown> | undefined>;
    return Boolean(parsed[key]?.['paper-camp']);
  } catch {
    return false;
  }
}

async function readFileOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    if (isEnoent(error)) return null;
    throw error;
  }
}

export async function collectDoctorContext(paperCampDir: string): Promise<DoctorContext> {
  const ideasDir = join(paperCampDir, 'ideas');
  const files: DoctorEntityFile[] = [];

  const dirs = [
    { dir: ideasDir, archived: false, names: await readdir(ideasDir) },
    {
      dir: join(ideasDir, 'archive'),
      archived: true,
      names: await readdirOptional(join(ideasDir, 'archive')),
    },
  ];

  for (const { dir, archived, names } of dirs) {
    const mdNames = names.filter((f) => f.endsWith('.md') && f !== 'index.md').sort();
    for (const name of mdNames) {
      files.push({
        id: basename(name, '.md'),
        path: `papercamp/ideas${archived ? '/archive' : ''}/${name}`,
        content: await readFile(join(dir, name), 'utf-8'),
        archived,
      });
    }
  }

  const root = dirname(paperCampDir);
  const config = await readConfig(join(paperCampDir, 'config.json'));
  return {
    files,
    config,
    hasPermissionsAllow: await readHasPermissionsAllow(root),
    hasMcpJsonEntry: await readHasPaperCampEntry(join(root, '.mcp.json'), 'mcpServers'),
    hasOpencodeJsonEntry: await readHasPaperCampEntry(join(root, 'opencode.json'), 'mcp'),
    draftPrWorkflowContent: await readFileOptional(
      join(root, '.github', 'workflows', 'draft-pr.yml'),
    ),
    pullRequestTemplateContent: await readFileOptional(
      join(root, '.github', 'pull_request_template.md'),
    ),
    localStateDrift: await readLocalStateDrift(root),
    assetFolders: await readAssetFolders(paperCampDir),
    assetMaxBytes: (config?.assets?.maxFileSizeMb ?? DEFAULT_ASSET_MAX_FILE_SIZE_MB) * 1024 * 1024,
  };
}

export function runDoctorChecks(context: DoctorContext): DoctorFinding[] {
  return DOCTOR_CHECKS.flatMap((check) => check(context));
}

export async function runDoctor(paperCampDir: string): Promise<DoctorFinding[]> {
  return runDoctorChecks(await collectDoctorContext(paperCampDir));
}
