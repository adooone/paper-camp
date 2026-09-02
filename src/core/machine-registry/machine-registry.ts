import { randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

export interface MachineProject {
  slug: string;
  path: string;
  name: string;
}

export interface MachineRegistry {
  version: 1;
  projects: MachineProject[];
}

const EMPTY_REGISTRY: MachineRegistry = { version: 1, projects: [] };

export function machineConfigDir(): string {
  return join(homedir(), '.config', 'paper-camp');
}

export function defaultRegistryPath(): string {
  return join(machineConfigDir(), 'projects.json');
}

function isMachineProject(value: unknown): value is MachineProject {
  const v = value as Partial<MachineProject> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.slug === 'string' &&
    typeof v.path === 'string' &&
    typeof v.name === 'string'
  );
}

function isMachineRegistry(value: unknown): value is MachineRegistry {
  const v = value as Partial<MachineRegistry> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    v.version === 1 &&
    Array.isArray(v.projects) &&
    v.projects.every(isMachineProject)
  );
}

/** Resolves the empty registry on a missing or malformed file — same first-boot
 * path a revoked or never-written file takes. */
export async function loadRegistry(path: string): Promise<MachineRegistry> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('paper-camp: could not read machine registry:', error);
    }
    return EMPTY_REGISTRY;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isMachineRegistry(parsed) ? parsed : EMPTY_REGISTRY;
  } catch {
    return EMPTY_REGISTRY;
  }
}

/** Written to a sibling temp path and renamed into place, so a crash mid-write
 * never leaves `loadRegistry` a truncated file to trip over. */
export async function saveRegistry(path: string, registry: MachineRegistry): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8');
  await rename(tmpPath, path);
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'project';
}

function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

export interface AddProjectResult {
  registry: MachineRegistry;
  entry: MachineProject;
  created: boolean;
}

/** Dedupes by resolved absolute path — re-adding an already-registered project
 * returns its existing entry rather than minting a second slug for it. */
export function addProject(
  registry: MachineRegistry,
  projectPath: string,
  name?: string,
): AddProjectResult {
  const path = resolve(projectPath);
  const existing = registry.projects.find((project) => project.path === path);
  if (existing) return { registry, entry: existing, created: false };

  const taken = new Set(registry.projects.map((project) => project.slug));
  const slug = uniqueSlug(slugify(basename(path)), taken);
  const entry: MachineProject = { slug, path, name: name ?? basename(path) };
  return {
    registry: { ...registry, projects: [...registry.projects, entry] },
    entry,
    created: true,
  };
}

export interface RemoveProjectResult {
  registry: MachineRegistry;
  removed: boolean;
}

export function removeProject(registry: MachineRegistry, slug: string): RemoveProjectResult {
  if (!registry.projects.some((project) => project.slug === slug)) {
    return { registry, removed: false };
  }
  return {
    registry: { ...registry, projects: registry.projects.filter((p) => p.slug !== slug) },
    removed: true,
  };
}

export function listProjects(registry: MachineRegistry): MachineProject[] {
  return [...registry.projects].sort((a, b) => a.slug.localeCompare(b.slug));
}

export interface ScanEntry {
  path: string;
  name: string;
  hasConfig: boolean;
}

async function inspectProject(
  configPath: string,
  fallbackName: string,
): Promise<{ hasConfig: boolean; name: string }> {
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch {
    return { hasConfig: false, name: fallbackName };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const projectName = (parsed as { projectName?: unknown })?.projectName;
    return {
      hasConfig: true,
      name: typeof projectName === 'string' && projectName ? projectName : fallbackName,
    };
  } catch {
    return { hasConfig: true, name: fallbackName };
  }
}

/** One level deep only — a project's own subdirectories are its concern, not the scan root's. */
export async function scanForProjects(dir: string): Promise<ScanEntry[]> {
  const root = resolve(dir);
  const dirents = await readdir(root, { withFileTypes: true });
  const entries: ScanEntry[] = [];
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    const projectPath = join(root, dirent.name);
    const configPath = join(projectPath, 'papercamp', 'config.json');
    const { hasConfig, name } = await inspectProject(configPath, dirent.name);
    entries.push({ path: projectPath, name, hasConfig });
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}
