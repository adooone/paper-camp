import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { deskConfigSchema } from '../parse';

const VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
];

const MONOREPO_GROUPS = ['apps', 'packages'];

const PLUGIN_PACKAGE = '@dendelion/paper-camp';
const PLUGIN_IMPORT_RE = /@dendelion\/paper-camp\/vite/;
const CD_PREFIX_RE = /^cd\s+(\S+)\s*&&/;

export interface ToolbarHostState {
  viteConfigPath: string | null;
  importsPlugin: boolean;
  isDependency: boolean;
}

function findViteConfig(dir: string): string | null {
  return VITE_CONFIG_FILES.find((file) => existsSync(join(dir, file))) ?? null;
}

function listSubdirs(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** The service with a port is the one serving HTTP, i.e. the frontend dev server —
 * the same signal this repo's own `desk.services` uses to tell `app` from `lib`. */
async function findFrontendServiceDir(root: string): Promise<string | null> {
  const raw = await readFile(join(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return null;
  let desk: unknown;
  try {
    desk = (JSON.parse(raw) as { desk?: unknown }).desk;
  } catch {
    return null;
  }
  const parsed = deskConfigSchema.safeParse(desk ?? {});
  if (!parsed.success) return null;
  const frontend = parsed.data.services?.find((service) => service.port !== undefined);
  const cwd = frontend?.cmd.match(CD_PREFIX_RE)?.[1];
  return cwd ? join(root, cwd) : null;
}

function findViteConfigUnderGroups(root: string): string | null {
  for (const group of MONOREPO_GROUPS) {
    for (const name of listSubdirs(join(root, group))) {
      if (findViteConfig(join(root, group, name))) return join(root, group, name);
    }
  }
  return null;
}

/** The frontend desk service's working directory, else the first app or package
 * with a Vite config, else the repo root. */
async function findHostDir(root: string): Promise<string> {
  const frontendDir = await findFrontendServiceDir(root);
  if (frontendDir && findViteConfig(frontendDir)) return frontendDir;
  return findViteConfigUnderGroups(root) ?? root;
}

async function hasPluginDependency(dir: string): Promise<boolean> {
  const raw = await readFile(join(dir, 'package.json'), 'utf-8').catch(() => null);
  if (!raw) return false;
  try {
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.[PLUGIN_PACKAGE] ?? pkg.devDependencies?.[PLUGIN_PACKAGE]);
  } catch {
    return false;
  }
}

/** Deterministic evidence for the Toolbar settings section — no agent call, unlike
 * `gatherProjectEvidence`'s desk proposal, since there's only one fact to classify. */
export async function detectToolbarHostState(root: string): Promise<ToolbarHostState> {
  const hostDir = await findHostDir(root);
  const configFile = findViteConfig(hostDir);
  const viteConfigPath = configFile ? relative(root, join(hostDir, configFile)) : null;
  const [content, isDependency] = await Promise.all([
    configFile ? readFile(join(hostDir, configFile), 'utf-8').catch(() => '') : '',
    hasPluginDependency(hostDir),
  ]);
  return {
    viteConfigPath,
    importsPlugin: viteConfigPath !== null && PLUGIN_IMPORT_RE.test(content),
    isDependency,
  };
}
