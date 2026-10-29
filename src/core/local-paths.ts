import { join } from 'node:path';

/** Also read by the IDEA-320 migration: nothing in this set may ever sit in a
 * project's `.gitignore` — a plan file is always meant to be committed. */
export const PLAN_NAMES = new Set([
  'ideas',
  'config.json',
  'suggestions.md',
  'chat.md',
  'about.md',
  'assets',
]);

/** The committed plan: `ideas/`, `config.json`, `suggestions.md`, `chat.md`, `about.md`,
 * `assets/` — everything else belongs under `localFile` or `machineFile` instead. */
export const planFile = (root: string, name: string): string => {
  if (!PLAN_NAMES.has(name)) {
    throw new Error(`planFile: "${name}" is not part of the plan — use localFile or machineFile`);
  }
  return join(root, 'papercamp', name);
};

/** This checkout's own state — logs, caches, run order — under `papercamp/.local/`,
 * which ignores itself via `papercamp/.local/.gitignore` and so is never committed. */
export const localFile = (root: string, name: string): string =>
  join(root, 'papercamp', '.local', name);

/** `chat.md` is shared and committed by every project, so appends from two clones
 * must merge without a conflict — a `merge=union` line in `.gitattributes` keeps
 * both sides' lines on pull. Read by both the IDEA-320 migration (which writes the
 * block) and doctor (which checks for it). */
export const GITATTRIBUTES_BLOCK_START = '# paper-camp:start';
export const GITATTRIBUTES_BLOCK_END = '# paper-camp:end';
export const GITATTRIBUTES_BLOCK_BODY = 'papercamp/chat.md merge=union';
