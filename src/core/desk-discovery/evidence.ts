import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runGit } from '../git-log';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface ProjectScript {
  name: string;
  cmd: string;
}

export interface NonJsManifest {
  kind: 'cargo' | 'python' | 'go' | 'make';
  path: string;
  targets: string[];
}

export interface ProjectEvidence {
  packageManager: PackageManager | null;
  scripts: ProjectScript[];
  devPort: number | null;
  gitOriginSlug: string | null;
  hasCiWorkflows: boolean;
  hasReleasePlease: boolean;
  nonJsManifests: NonJsManifest[];
}

const LOCKFILE_MANAGERS: [file: string, manager: PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['package-lock.json', 'npm'],
];

const RELEASE_PLEASE_PATHS = [
  'release-please-config.json',
  '.release-please-manifest.json',
  '.github/release-please-config.json',
  '.github/.release-please-manifest.json',
];

const DEV_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'next.config.ts',
  'next.config.js',
  'next.config.mjs',
  'astro.config.ts',
  'astro.config.mjs',
];

const PORT_FLAG_RE = /(?:--port|-p)[=\s]+(\d{2,5})/;
const CONFIG_PORT_RE = /port\s*:\s*(\d{2,5})/;
const SERVER_BLOCK_OPENER_RE = /server\s*:\s*\{/g;
const MAKEFILE_TARGET_RE = /^([A-Za-z0-9][A-Za-z0-9_.-]*)\s*:(?!=)/gm;
const CARGO_NAME_RE = /^\s*name\s*=\s*"([^"]+)"/gm;
const PYPROJECT_SCRIPT_SECTION_RE =
  /\[(?:tool\.poetry\.scripts|project\.scripts)\]([\s\S]*?)(?=\n\[|$)/;
const SCRIPT_KEY_RE = /^\s*([A-Za-z0-9_-]+)\s*=/gm;
const GO_MODULE_RE = /^module\s+(\S+)/m;

function detectPackageManager(root: string): PackageManager | null {
  for (const [file, manager] of LOCKFILE_MANAGERS) {
    if (existsSync(join(root, file))) return manager;
  }
  return null;
}

async function readScripts(root: string): Promise<ProjectScript[]> {
  try {
    const raw = await readFile(join(root, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Object.entries(parsed.scripts ?? {}).map(([name, cmd]) => ({ name, cmd }));
  } catch {
    return [];
  }
}

function findPortInScripts(scripts: ProjectScript[]): number | null {
  const devScript =
    scripts.find((s) => s.name === 'dev') ?? scripts.find((s) => /^dev[:-]/.test(s.name));
  for (const script of devScript ? [devScript] : scripts) {
    const match = script.cmd.match(PORT_FLAG_RE);
    if (match) return Number(match[1]);
  }
  return null;
}

async function findPortInConfig(root: string): Promise<number | null> {
  for (const file of DEV_CONFIG_FILES) {
    if (!existsSync(join(root, file))) continue;
    const raw = await readFile(join(root, file), 'utf-8').catch(() => '');
    const serverBlock = firstServerBlockBody(raw);
    if (!serverBlock) continue;
    // Nested sub-objects (hmr, proxy, …) can carry their own `port:` key — only a
    // top-level key in the server block is actually the dev server's port.
    const portInServer = stripNestedBraces(serverBlock).match(CONFIG_PORT_RE);
    if (portInServer) return Number(portInServer[1]);
  }
  return null;
}

function stripNestedBraces(body: string): string {
  let result = '';
  let depth = 0;
  for (const ch of body) {
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      continue;
    }
    if (depth === 0) result += ch;
  }
  return result;
}

function firstServerBlockBody(raw: string): string | null {
  SERVER_BLOCK_OPENER_RE.lastIndex = 0;
  for (const match of raw.matchAll(SERVER_BLOCK_OPENER_RE)) {
    const openBrace = (match.index ?? 0) + match[0].length - 1;
    const closeBrace = findMatchingBrace(raw, openBrace);
    if (closeBrace === -1) continue;
    return raw.slice(openBrace + 1, closeBrace);
  }
  return null;
}

function findMatchingBrace(raw: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

async function detectDevPort(root: string, scripts: ProjectScript[]): Promise<number | null> {
  return findPortInScripts(scripts) ?? (await findPortInConfig(root));
}

async function detectGitOriginSlug(root: string): Promise<string | null> {
  const url = (await runGit(root, ['remote', 'get-url', 'origin'])).trim();
  if (!url) return null;
  const match = url.match(/[/:]([^/:]+\/[^/]+?)(?:\.git)?$/);
  return match ? match[1] : null;
}

function detectCiWorkflows(root: string): boolean {
  try {
    return readdirSync(join(root, '.github', 'workflows')).length > 0;
  } catch {
    return false;
  }
}

function detectReleasePlease(root: string): boolean {
  return RELEASE_PLEASE_PATHS.some((path) => existsSync(join(root, path)));
}

function cargoTargets(content: string): string[] {
  return [...new Set([...content.matchAll(CARGO_NAME_RE)].map((m) => m[1]))];
}

function pyprojectTargets(content: string): string[] {
  const section = content.match(PYPROJECT_SCRIPT_SECTION_RE);
  if (!section) return [];
  return [...section[1].matchAll(SCRIPT_KEY_RE)].map((m) => m[1]);
}

function goTargets(content: string): string[] {
  const match = content.match(GO_MODULE_RE);
  return match ? [match[1]] : [];
}

function makeTargets(content: string): string[] {
  const targets: string[] = [];
  for (const match of content.matchAll(MAKEFILE_TARGET_RE)) {
    const name = match[1];
    if (!name.startsWith('.') && !targets.includes(name)) targets.push(name);
  }
  return targets;
}

const NON_JS_MANIFESTS: {
  file: string;
  kind: NonJsManifest['kind'];
  parse: (content: string) => string[];
}[] = [
  { file: 'Cargo.toml', kind: 'cargo', parse: cargoTargets },
  { file: 'pyproject.toml', kind: 'python', parse: pyprojectTargets },
  { file: 'go.mod', kind: 'go', parse: goTargets },
  { file: 'Makefile', kind: 'make', parse: makeTargets },
];

async function detectNonJsManifests(root: string): Promise<NonJsManifest[]> {
  const manifests: NonJsManifest[] = [];
  for (const { file, kind, parse } of NON_JS_MANIFESTS) {
    if (!existsSync(join(root, file))) continue;
    const content = await readFile(join(root, file), 'utf-8').catch(() => '');
    manifests.push({ kind, path: file, targets: parse(content) });
  }
  return manifests;
}

export async function gatherProjectEvidence(root: string): Promise<ProjectEvidence> {
  const scripts = await readScripts(root);
  const [devPort, gitOriginSlug, nonJsManifests] = await Promise.all([
    detectDevPort(root, scripts),
    detectGitOriginSlug(root),
    detectNonJsManifests(root),
  ]);
  return {
    packageManager: detectPackageManager(root),
    scripts,
    devPort,
    gitOriginSlug,
    hasCiWorkflows: detectCiWorkflows(root),
    hasReleasePlease: detectReleasePlease(root),
    nonJsManifests,
  };
}
