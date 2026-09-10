import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
];

const PLUGIN_PACKAGE = '@dendelion/paper-camp';
const PLUGIN_IMPORT_RE = /@dendelion\/paper-camp\/vite/;

export interface ToolbarHostState {
  viteConfigPath: string | null;
  importsPlugin: boolean;
  isDependency: boolean;
}

function findViteConfig(root: string): string | null {
  return VITE_CONFIG_FILES.find((file) => existsSync(join(root, file))) ?? null;
}

async function hasPluginDependency(root: string): Promise<boolean> {
  const raw = await readFile(join(root, 'package.json'), 'utf-8').catch(() => null);
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
  const viteConfigPath = findViteConfig(root);
  const [content, isDependency] = await Promise.all([
    viteConfigPath ? readFile(join(root, viteConfigPath), 'utf-8').catch(() => '') : '',
    hasPluginDependency(root),
  ]);
  return {
    viteConfigPath,
    importsPlugin: viteConfigPath !== null && PLUGIN_IMPORT_RE.test(content),
    isDependency,
  };
}
