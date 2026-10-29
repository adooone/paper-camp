import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { access, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { adoptCapacityRecord } from '@/core/capacity';
import { PLAN_NAMES, localFile } from '@/core/corpus';
import { DAEMON_GITIGNORE_ENTRIES, ensureLocalGitignore } from '@/core/scaffold/scaffold';
import { savePairingState } from './pairing';

export interface MigrationResult {
  status: 'migrated' | 'skipped' | 'no-op';
  skipReason?: 'rebase-in-progress' | 'staged-changes';
  rotatedPairingToken: boolean;
  adoptedCapacity: boolean;
}

const COMMIT_MESSAGE = 'chore(papercamp): Move local state to papercamp/.local';

// Plain renames: the old daemon-managed name under papercamp/ maps straight onto
// the same name under papercamp/.local/, no special handling needed.
const RENAMED_LOCAL_FILES = [
  { old: '.task-logs', local: 'task-logs' },
  { old: 'tasks.log', local: 'tasks.log' },
  { old: 'notifications.log', local: 'notifications.log' },
  { old: 'pr-reviews.json', local: 'pr-reviews.json' },
  { old: 'pr-map.json', local: 'pr-map.json' },
  { old: 'night.json', local: 'night.json' },
  { old: 'run-order.md', local: 'run-order.md' },
] as const;

const GITATTRIBUTES_BLOCK_START = '# paper-camp:start';
const GITATTRIBUTES_BLOCK_END = '# paper-camp:end';
const GITATTRIBUTES_BLOCK_BODY = 'papercamp/chat.md merge=union';

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function runGit(root: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const proc = spawn('git', ['-c', 'core.quotepath=off', ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
    });
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => resolve({ code: code ?? 1, stdout }));
    proc.on('error', () => resolve({ code: 1, stdout }));
  });
}

async function isGitRepo(root: string): Promise<boolean> {
  const { code } = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
  return code === 0;
}

// No existing check tells a rebase mid-conflict apart from a landed one (mirrors
// the same check in git.ts) — a migration commit mid-rebase would land on the
// wrong parent.
async function isRebaseInProgress(root: string): Promise<boolean> {
  for (const name of ['rebase-merge', 'rebase-apply']) {
    const { code, stdout } = await runGit(root, ['rev-parse', '--git-path', name]);
    if (code !== 0) continue;
    const path = stdout.trim();
    const full = path.startsWith('/') ? path : join(root, path);
    try {
      await lstat(full);
      return true;
    } catch {}
  }
  return false;
}

async function hasStagedChanges(root: string): Promise<boolean> {
  const { stdout } = await runGit(root, ['diff', '--cached', '--name-only']);
  return stdout.trim().length > 0;
}

async function isTracked(root: string, relPath: string): Promise<boolean> {
  const { stdout } = await runGit(root, ['ls-files', '--', relPath]);
  return stdout.trim().length > 0;
}

async function wasEverCommitted(root: string, relPath: string): Promise<boolean> {
  const { stdout } = await runGit(root, ['log', '--all', '-1', '--format=%H', '--', relPath]);
  return stdout.trim().length > 0;
}

async function untrack(root: string, relPath: string): Promise<void> {
  await runGit(root, ['rm', '--cached', '-r', '--ignore-unmatch', '--', relPath]);
}

// Moves an old papercamp/<name> file or directory onto its papercamp/.local/<name>
// home. If something already lives at the destination (an earlier partial run, or
// phase 1's own code already having written there), the destination wins and the
// stale source is just discarded — there is nowhere else for it to go.
async function moveIntoLocal(oldPath: string, newPath: string): Promise<void> {
  if (await pathExists(newPath)) {
    await rm(oldPath, { recursive: true, force: true });
    return;
  }
  await mkdir(dirname(newPath), { recursive: true });
  await rename(oldPath, newPath);
}

// Nothing under PLAN_NAMES may ever sit in .gitignore (a plan file is always meant
// to be committed — this is what settles paper-camp's own chat.md drift), and every
// pre-.local entry in DAEMON_GITIGNORE_ENTRIES is now redundant with papercamp/.local/
// ignoring itself. Comment lines explaining one of those entries, written directly
// above it with no blank line between, are dropped along with it.
async function cleanGitignore(root: string): Promise<boolean> {
  const path = join(root, '.gitignore');
  const content = await readFile(path, 'utf-8').catch(() => null);
  if (content === null) return false;

  const targets = new Set<string>([
    ...DAEMON_GITIGNORE_ENTRIES,
    ...[...PLAN_NAMES].map((name) => `papercamp/${name}`),
  ]);

  const kept: string[] = [];
  for (const line of content.split('\n')) {
    if (targets.has(line.trim())) {
      while (kept.length > 0 && kept[kept.length - 1].trim().startsWith('#')) {
        kept.pop();
      }
      continue;
    }
    kept.push(line);
  }

  const next = kept.join('\n');
  if (next === content) return false;
  await writeFile(path, next, 'utf-8');
  return true;
}

// `chat.md` is shared and committed by every project, so appends from two clones
// must merge without a conflict — `merge=union` keeps both sides' lines on pull.
// The block is replaced wholesale on re-run rather than diffed, so it stays in sync
// with GITATTRIBUTES_BLOCK_BODY across upgrades.
async function ensureGitattributesBlock(root: string): Promise<boolean> {
  const path = join(root, '.gitattributes');
  const content = await readFile(path, 'utf-8').catch(() => '');
  const block = `${GITATTRIBUTES_BLOCK_START}\n${GITATTRIBUTES_BLOCK_BODY}\n${GITATTRIBUTES_BLOCK_END}`;
  const blockRe = new RegExp(
    `${GITATTRIBUTES_BLOCK_START}[\\s\\S]*?${GITATTRIBUTES_BLOCK_END}`,
    'm',
  );

  let next: string;
  if (blockRe.test(content)) {
    next = content.replace(blockRe, block);
  } else if (content.length === 0) {
    next = `${block}\n`;
  } else {
    const withTrailingNewline = content.endsWith('\n') ? content : `${content}\n`;
    next = `${withTrailingNewline}\n${block}\n`;
  }

  if (next === content) return false;
  await writeFile(path, next, 'utf-8');
  return true;
}

/** Runs once on a project's first mount under the upgraded daemon: moves every
 * daemon-local file onto its papercamp/.local/ home, untracks whatever of that was
 * committed, cleans the file list this replaces out of .gitignore, writes the
 * .gitattributes union block for chat.md, and makes one commit. Skips (for a retry
 * on the next mount) a project that's mid-rebase or has staged changes, since either
 * would make `git rm --cached` and the commit land on the wrong thing. */
export async function migrateLocalState(root: string): Promise<MigrationResult> {
  const noop: MigrationResult = {
    status: 'no-op',
    rotatedPairingToken: false,
    adoptedCapacity: false,
  };
  if (!(await isGitRepo(root))) return noop;

  if (await isRebaseInProgress(root)) {
    return {
      status: 'skipped',
      skipReason: 'rebase-in-progress',
      rotatedPairingToken: false,
      adoptedCapacity: false,
    };
  }
  if (await hasStagedChanges(root)) {
    return {
      status: 'skipped',
      skipReason: 'staged-changes',
      rotatedPairingToken: false,
      adoptedCapacity: false,
    };
  }

  const campDir = join(root, 'papercamp');
  const toUntrack: string[] = [];
  let movedAnything = false;

  for (const { old, local } of RENAMED_LOCAL_FILES) {
    const relOld = join('papercamp', old);
    if (await isTracked(root, relOld)) toUntrack.push(relOld);
    const oldPath = join(campDir, old);
    if (await pathExists(oldPath)) {
      await ensureLocalGitignore(campDir);
      await moveIntoLocal(oldPath, localFile(root, local));
      movedAnything = true;
    }
  }

  const relOldPairing = join('papercamp', '.pairing.json');
  const pairingEverCommitted = await wasEverCommitted(root, relOldPairing);
  if (await isTracked(root, relOldPairing)) toUntrack.push(relOldPairing);
  const oldPairingPath = join(campDir, '.pairing.json');
  const newPairingPath = localFile(root, 'pairing.json');
  if (await pathExists(oldPairingPath)) {
    await ensureLocalGitignore(campDir);
    await moveIntoLocal(oldPairingPath, newPairingPath);
    movedAnything = true;
  }
  let rotatedPairingToken = false;
  if (pairingEverCommitted) {
    // The old token is permanently readable in that project's git history (and, for
    // a public repo, on GitHub) — minting a fresh one and dropping the old state is
    // the only way to make the leaked token stop working.
    await savePairingState(newPairingPath, {
      token: randomBytes(32).toString('hex'),
      origins: new Set(),
    });
    rotatedPairingToken = true;
    movedAnything = true;
  }

  const relOldCapacity = join('papercamp', 'capacity.json');
  if (await isTracked(root, relOldCapacity)) toUntrack.push(relOldCapacity);
  const oldCapacityPath = join(campDir, 'capacity.json');
  let adoptedCapacity = false;
  if (await pathExists(oldCapacityPath)) {
    const raw = await readFile(oldCapacityPath, 'utf-8').catch(() => null);
    if (raw) {
      try {
        adoptedCapacity = await adoptCapacityRecord(JSON.parse(raw));
      } catch {}
    }
    await rm(oldCapacityPath, { force: true });
    movedAnything = true;
  }

  for (const relPath of toUntrack) await untrack(root, relPath);

  const gitignoreChanged = await cleanGitignore(root);
  const gitattributesChanged = await ensureGitattributesBlock(root);

  if (!movedAnything && toUntrack.length === 0 && !gitignoreChanged && !gitattributesChanged) {
    return { status: 'no-op', rotatedPairingToken, adoptedCapacity };
  }

  if (gitignoreChanged && (await pathExists(join(root, '.gitignore')))) {
    await runGit(root, ['add', '--', '.gitignore']);
  }
  if (gitattributesChanged) {
    await runGit(root, ['add', '--', '.gitattributes']);
  }

  const { stdout: staged } = await runGit(root, ['diff', '--cached', '--name-only']);
  if (staged.trim().length === 0) {
    return { status: 'no-op', rotatedPairingToken, adoptedCapacity };
  }

  await runGit(root, ['commit', '--no-verify', '-m', COMMIT_MESSAGE]);
  return { status: 'migrated', rotatedPairingToken, adoptedCapacity };
}
