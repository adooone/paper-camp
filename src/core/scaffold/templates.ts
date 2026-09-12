// Kept in one place so `init`'s no-clobber writes stay simple string dumps.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const LOCKFILE_PACKAGE_MANAGERS: Array<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

export function detectPackageManager(targetDir: string): PackageManager {
  for (const [lockfile, packageManager] of LOCKFILE_PACKAGE_MANAGERS) {
    if (existsSync(join(targetDir, lockfile))) return packageManager;
  }
  return 'npm';
}

function readPackageJson(targetDir: string): Record<string, unknown> | undefined {
  const path = join(targetDir, 'package.json');
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return undefined;
  }
}

const PAPER_CAMP_PACKAGE_NAME = '@dendelion/paper-camp';

export function hasPaperCampDependency(targetDir: string): boolean {
  const pkg = readPackageJson(targetDir);
  if (!pkg) return false;
  const dependencies = pkg.dependencies as Record<string, string> | undefined;
  const devDependencies = pkg.devDependencies as Record<string, string> | undefined;
  return Boolean(
    dependencies?.[PAPER_CAMP_PACKAGE_NAME] || devDependencies?.[PAPER_CAMP_PACKAGE_NAME],
  );
}

const ROOT_EDIT_GLOBS = ['*.json', '*.ts', '*.tsx', '*.md', '*.config.*'];
const EDIT_DIRS = ['src/**', 'app/**', 'scripts/**', 'papercamp/**'];

const READ_ONLY_GIT_COMMANDS = ['git status*', 'git diff*', 'git log*'];
const READ_ONLY_SHELL_COMMANDS = ['ls*', 'cat*', 'wc*'];

const PACKAGE_MANAGER_VERBS = ['run *', 'test*', 'install*', 'view *', 'pack*', 'ls*'];

const NPX_COMMANDS = ['npx tsc*', 'npx biome check*', 'npx vitest*', 'npx jest*', 'npx expo *'];

export function buildPermissionsAllow(packageManager: PackageManager): string[] {
  const editAllow = EDIT_DIRS.flatMap((glob) => [`Edit(${glob})`, `Write(${glob})`]);
  const rootEditAllow = ROOT_EDIT_GLOBS.flatMap((glob) => [`Edit(${glob})`, `Write(${glob})`]);
  const bashAllow = [
    ...READ_ONLY_GIT_COMMANDS,
    ...READ_ONLY_SHELL_COMMANDS,
    ...PACKAGE_MANAGER_VERBS.map((verb) => `${packageManager} ${verb}`),
    ...NPX_COMMANDS,
  ].map((command) => `Bash(${command})`);

  return [...editAllow, ...rootEditAllow, ...bashAllow];
}

export function buildSessionStartCommand(hasDependency: boolean): string {
  return hasDependency ? `"${PAPER_CAMP_BIN}" session-focus` : 'paper-camp session-focus';
}

export function mergeClaudeSettingsJson(existingContent: string, targetDir: string): string {
  let settings: Record<string, unknown>;
  try {
    settings = JSON.parse(existingContent);
  } catch {
    return existingContent;
  }

  const generatedAllow = buildPermissionsAllow(detectPackageManager(targetDir));
  const permissions = (settings.permissions as { allow?: string[] } | undefined) ?? {};
  const existingAllow = Array.isArray(permissions.allow) ? permissions.allow : [];
  const missing = generatedAllow.filter((entry) => !existingAllow.includes(entry));

  if (missing.length === 0 && settings.permissions !== undefined) return existingContent;

  settings.permissions = { ...permissions, allow: [...existingAllow, ...missing] };
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function buildClaudeSettingsJson(targetDir: string): string {
  const packageManager = detectPackageManager(targetDir);
  const command = buildSessionStartCommand(hasPaperCampDependency(targetDir));

  return `${JSON.stringify(
    {
      permissions: {
        allow: buildPermissionsAllow(packageManager),
      },
      hooks: {
        SessionStart: [
          {
            matcher: '*',
            hooks: [{ type: 'command', command }],
          },
        ],
      },
    },
    null,
    2,
  )}\n`;
}

export const SKILL_MD_CONTENT = `---
name: paper-camp
description: Work inside a project that has a papercamp/ folder — its unified idea entities (each holding its plan as a section), with decisions and open questions logged as notes on the idea they bind. Use this whenever the working directory contains papercamp/ (papercamp/ideas/), and especially before starting, continuing, or completing any plan phase, drafting an idea, logging a decision, or answering "what are we working on / what's next".
---

# Paper Camp

Paper Camp is this project's planning methodology: plans and ideas are one
thing, a unified entity file under \`papercamp/ideas/\`, with decisions and
open questions logged as notes bound to the idea they concern. This skill
tells you how to read that state before acting and how to keep it honest as
you work.

If a \`papercamp\` MCP server is connected in this session, prefer its tools
(list/get plans, update phase, etc.) over raw file access —
they enforce the same guards (id allocation, branch conflicts) that the file
grammar below assumes. Everything in this skill still applies conceptually;
only the mechanism changes.

## Before doing any work

Read, in this order, whatever exists:

1. \`papercamp/ideas/\` — one file per entity, named by id. Ideas and plans are
   one thing: an entity is an *idea* for its whole life, and its plan is a
   \`### Phases\` section inside the same file.
2. The specific entity file at \`papercamp/ideas/<ID>.md\` (e.g. \`IDEA-43.md\`)
   for the work you're about to do — YAML frontmatter (\`id\`, \`title\`,
   \`type\`, \`status\`, \`tags\`, ...) plus prose rationale, then optionally a
   \`### Phases\` list of \`- [ ]\`/\`- [x]\` checkboxes with an indented
   description under each. Done/dropped entities live in
   \`papercamp/ideas/archive/\`.
   Its notes carry any decision or open question bound to it — settled calls
   you shouldn't re-litigate without flagging it to the user first, and
   unresolved questions that might block or redirect the work you're about
   to start.

Skip files that don't exist yet (a fresh project may have empty logs).

## While working

- Work one plan phase at a time unless told otherwise — don't cascade into
  later phases just because they look quick.
- If a phase's boundary or intent is unclear, ask before continuing.
- Prose in plans and ideas is more current than your memory of past
  conversations. If they conflict, the files win — say so and resync.

## Keep the project current as you go

- **Plan phases**: when you finish a phase, flip its checkbox from \`- [ ]\` to
  \`- [x]\` in the plan's frontmatter file. Change only that line — don't touch
  other phases or prose.
- **Plan status**: keep the plan's \`status:\` frontmatter honest
  (\`planned\` / \`in-progress\` / \`review\` / \`done\`). When every phase is
  checked, set status to \`review\` — never \`done\`. \`done\` is a human-only
  promotion after review; an agent finishing the last phase does not close
  the plan itself.
- **Decisions / open questions**: if you settle something ambiguous while
  working, log it as a decision note on the idea it bounds; if you surface a
  question you can't resolve yourself, add it as a question note on that idea
  rather than guessing silently.

## What this skill deliberately does not do

It does not maintain a separate "current focus" file — that's derived at
session start from live plan data, not hand-maintained here. It does
not define the file formats in full; treat the existing files under
\`papercamp/\` as the grammar reference (mirror their structure exactly rather
than inventing a new shape).
`;

const PAPER_CAMP_BIN = '$CLAUDE_PROJECT_DIR/node_modules/.bin/paper-camp';
