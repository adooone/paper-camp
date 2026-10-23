import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { branchName, resolvePrsByEntity } from '@/core/git-pr';
import { parseEntityFile } from '@/core/parse/parser';
import type {
  BranchHygieneStatus,
  FileDiffEntry,
  GitLiveState,
  GitStashEntry,
  GitStatusEntry,
  GitSyncResult,
  PhaseState,
  PlanEntry,
  StaleBaseRef,
} from '../../types';
import { buildGitSyncRecoveryPrompt } from './git-sync-recovery';
import { buildResolveConflictPrompt } from './resolve-conflict-prompt';

const AI_DIFF_BLOCKLIST = [/(^|\/)\.env(\.|$)/i, /\.(pem|key|p12|crt)$/i];

// Unmerged porcelain status codes — a rebase (or merge) conflict, as opposed to a plain edit.
const CONFLICT_STATUSES = new Set(['UU', 'AA', 'DD', 'AU', 'UA', 'DU', 'UD']);

/** Thrown by assertCleanWorkingTree so a caller can refuse before merging, rather
 * than landing a squash-merge and only then failing to switch to main. */
class DirtyWorkingTreeError extends Error {
  files: string[];

  constructor(files: string[]) {
    super(`Working tree has uncommitted changes: ${files.join(', ')}`);
    this.files = files;
  }
}

// Thrown by fixDivergence under strictFetch so a caller can tell a network failure
// (worth a 502) apart from a reconcile failure that reconciled against stale refs.
export class FetchFailedError extends Error {}

export interface ReturnToMainResult {
  branch: string;
  remoteDeleted: boolean;
}

export interface DirectCompletionCheck {
  ready: boolean;
  missing: string[];
}

export interface StatusSnapshot {
  branch: string;
  ahead: number;
  behind: number;
  hasUpstream: boolean;
  entries: GitStatusEntry[];
}

// Thrown by reconcileOnto so callers can tell a genuine content conflict — one that needs
// domain judgement to resolve — apart from any other reconcile failure (fetch, checkout, ...).
class RebaseConflictError extends Error {
  ref: string;
  conflictedFiles: string[];
  conflictedContent: { path: string; content: string }[];

  constructor(
    ref: string,
    conflictedFiles: string[],
    conflictedContent: { path: string; content: string }[],
  ) {
    super(
      `Diverged from ${ref} and auto-rebase hit a conflict — resolve it, or hand it to the agent`,
    );
    this.ref = ref;
    this.conflictedFiles = conflictedFiles;
    this.conflictedContent = conflictedContent;
  }
}

// Git expands pathspec magic (e.g. `:/`) even after `--`; force literal so a
// caller-selected path can't silently widen to unrelated files.
const toLiteralPathspec = (file: string) => `:(literal)${file}`;

export type GitManager = ReturnType<typeof createGitManager>;

export function createGitManager(root: string, onRemoteChanged?: () => void) {
  function parsePorcelain(output: string): GitStatusEntry[] {
    const entries: GitStatusEntry[] = [];
    for (const line of output.split('\n')) {
      if (!line.trim()) continue;
      const x = line[0] ?? ' ';
      const y = line[1] ?? ' ';
      const rest = line.slice(3);
      const parts = rest.split(' -> ');
      const path = parts.pop() ?? rest;
      entries.push({
        path,
        status: `${x}${y}`,
        staged: x !== ' ' && x !== '?',
        renameSource: (x === 'R' || x === 'C') && parts.length > 0 ? parts[0] : undefined,
      });
    }
    return entries;
  }

  // One `status --porcelain=v2 --branch` call replaces the separate status/ahead/behind
  // spawns: the branch.ab header carries both counts, measured against the same ref.
  function parsePorcelainV2Branch(output: string): StatusSnapshot {
    let branch = '';
    let ahead = 0;
    let behind = 0;
    let hasUpstream = false;
    const entries: GitStatusEntry[] = [];
    for (const line of output.split('\n')) {
      if (!line) continue;
      if (line.startsWith('# branch.head ')) {
        branch = line.slice('# branch.head '.length).trim();
        continue;
      }
      if (line.startsWith('# branch.ab ')) {
        hasUpstream = true;
        const match = /\+(\d+) -(\d+)/.exec(line);
        if (match) {
          ahead = Number.parseInt(match[1], 10);
          behind = Number.parseInt(match[2], 10);
        }
        continue;
      }
      if (line.startsWith('#')) continue;
      const kind = line[0];
      if (kind === '1' || kind === '2') {
        const parts = line.split(' ');
        const xy = parts[1] ?? '..';
        const status = `${xy[0] === '.' ? ' ' : xy[0]}${xy[1] === '.' ? ' ' : xy[1]}`;
        const staged = xy[0] !== '.';
        if (kind === '1') {
          entries.push({ path: parts.slice(8).join(' '), status, staged });
        } else {
          const [path, renameSource] = parts.slice(9).join(' ').split('\t');
          entries.push({ path, status, staged, renameSource });
        }
        continue;
      }
      if (kind === 'u') {
        const parts = line.split(' ');
        entries.push({ path: parts.slice(10).join(' '), status: parts[1] ?? '', staged: true });
        continue;
      }
      if (kind === '?') {
        entries.push({ path: line.slice(2), status: '??', staged: false });
      }
    }
    return { branch, ahead, behind, hasUpstream, entries };
  }

  const GIT_TIMEOUT_MS = 30_000;

  function runGit(args: string[], stdin?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // quotepath=off: non-ASCII paths stay raw UTF-8 instead of octal-escaped,
      // which would otherwise garble every downstream pathspec.
      const proc = spawn('git', ['-c', 'core.quotepath=off', ...args], {
        cwd: root,
        stdio: [stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        // A read command (status, log) would otherwise take an opportunistic lock on
        // the index to refresh its stat cache, racing a concurrent `git add`/`commit`.
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' },
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        proc.kill();
        reject(new Error(`git ${args[0]} timed out after ${GIT_TIMEOUT_MS / 1000}s`));
      }, GIT_TIMEOUT_MS);
      proc.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on('close', (code) => {
        if (settled) return;
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout || `git ${args[0]} exited with code ${code}`));
        }
      });
      proc.on('error', (err) => {
        if (settled) return;
        clearTimeout(timer);
        reject(err);
      });
      if (stdin !== undefined) proc.stdin?.end(stdin);
    });
  }

  function runGitStatus(options?: { untrackedFiles?: 'all' }): Promise<GitStatusEntry[]> {
    const args = ['status', '--porcelain=v1'];
    if (options?.untrackedFiles) args.push(`--untracked-files=${options.untrackedFiles}`);
    return runGit(args).then(parsePorcelain);
  }

  function getStatusSnapshot(): Promise<StatusSnapshot> {
    return runGit(['status', '--porcelain=v2', '--branch']).then(parsePorcelainV2Branch);
  }

  async function assertCleanWorkingTree(): Promise<void> {
    const status = await runGitStatus();
    if (status.length > 0) {
      throw new DirtyWorkingTreeError(status.map((entry) => entry.path));
    }
  }

  async function commit(
    files: string[],
    title: string,
    message?: string,
    options?: { noVerify?: boolean },
  ): Promise<void> {
    let renameSources = new Map<string, string>();
    let toAdd: string[] = [];
    if (files.length > 0) {
      const statusEntries = await runGitStatus();
      const statusByPath = new Map(statusEntries.map((e) => [e.path, e.status]));
      renameSources = new Map(
        statusEntries
          .filter((e): e is GitStatusEntry & { renameSource: string } => !!e.renameSource)
          .map((e) => [e.path, e.renameSource]),
      );
      // A fully-staged file has nothing left for `git add` to match; passing it
      // anyway makes git fail with "did not match any files".
      toAdd = files.filter((f) => {
        const status = statusByPath.get(f);
        return status === undefined || status[1] !== ' ';
      });
    }
    const args = ['commit'];
    // Machine-generated commit messages are valid-by-construction and must never
    // be blocked by a human-oriented lint hook.
    if (options?.noVerify) args.push('--no-verify');
    args.push('-m', title);
    if (message) args.push('-m', message);
    if (files.length > 0) {
      // A staged rename spans two paths; restricting to the new path alone would
      // leave the old path's staged deletion behind, so include the source too.
      const pathspecs = files.flatMap((f) => {
        const source = renameSources.get(f);
        return source ? [f, source] : [f];
      });
      args.push('--', ...pathspecs.map(toLiteralPathspec));
    }
    // Add and commit share one withIndex call: a concurrent stagePath between them
    // would otherwise hit index.lock, or commit a different index than was just staged.
    await withIndex(async () => {
      if (toAdd.length > 0) {
        await runGit(['add', '--', ...toAdd.map(toLiteralPathspec)]);
      }
      await runGit(args);
    });
  }

  // Scoped to papercamp/ only — unrelated dirty state outside the corpus is left
  // for the caller's own commit steps.
  async function commitCorpus(subject: string, refsId?: string): Promise<void> {
    const status = await runGitStatus();
    const files = status.filter((entry) => entry.path.startsWith('papercamp/')).map((e) => e.path);
    if (files.length === 0) return;
    await commit(files, subject, refsId ? `Refs: ${refsId}` : undefined, { noVerify: true });
  }

  function branchExists(branch: string): boolean {
    return (
      spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root })
        .status === 0
    );
  }

  async function ensureBranch(plan: PlanEntry): Promise<string | undefined> {
    const planId = plan.id;
    const branch = branchName(planId, plan.kind, plan.title);
    if (!branch || !planId) return undefined;

    const currentResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    if (currentResult.status !== 0) {
      throw new Error(
        currentResult.stderr.toString().trim() || 'Unable to read current git branch',
      );
    }
    const currentBranch = currentResult.stdout.toString().trim();
    if (currentBranch === branch) return undefined;

    // Whether the branch already exists decides create-vs-checkout — inferring it from
    // a `checkout -b` failure would misreport a dirty/blocked worktree as "branch exists".
    if (branchExists(branch)) {
      const checkoutResult = spawnSync('git', ['checkout', branch], { cwd: root });
      if (checkoutResult.status !== 0) {
        throw new Error(checkoutResult.stderr.toString().trim() || `Unable to check out ${branch}`);
      }
      return undefined;
    }

    // Branch off the freshest main: refresh origin/main and prefer it over stale local
    // main. Bounded + non-interactive so an unreachable remote can't hang the request.
    spawnSync('git', ['fetch', 'origin', 'main'], {
      cwd: root,
      timeout: 5000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    const base =
      spawnSync('git', ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], {
        cwd: root,
      }).status === 0
        ? 'origin/main'
        : 'main';

    // Read before checkout moves HEAD: the new branch inherits whatever corpus state
    // HEAD carries, so a stale fork is warned about now, not after silently redone work.
    const stale = await findStaleBaseRef(planId);
    const warning = stale
      ? `${planId} already has ${stale.done}/${stale.total} phases complete on ${stale.ref} — this new branch forks from before that work, so it will inherit the stale corpus state. Rebase onto ${stale.ref} once created.`
      : undefined;

    // --no-track: off a remote ref, git would set upstream to origin/main, then refuse
    // `git push` because the upstream name doesn't match the branch name.
    const result = spawnSync('git', ['checkout', '-b', branch, '--no-track', base], { cwd: root });
    if (result.status !== 0) {
      // Surface git's real error (e.g. uncommitted changes would be overwritten),
      // not a fabricated "branch exists" fallback.
      throw new Error(result.stderr.toString().trim() || `Unable to create branch ${branch}`);
    }
    return warning;
  }

  // `git branch -d` would refuse here: squashing rewrites the SHA, so the branch
  // never reads as merged into main — `-D` is required, not a skipped safety check.
  async function returnToMain(): Promise<ReturnToMainResult> {
    const branch = getCurrentBranch();
    await runGit(['fetch', 'origin', 'main']);
    await runGit(['checkout', 'main']);
    await runGit(['merge', '--ff-only', 'origin/main']);
    if (branch === 'main' || branch === 'master') {
      return { branch, remoteDeleted: false };
    }
    await runGit(['branch', '-D', branch]);
    let remoteDeleted = false;
    try {
      await runGit(['push', 'origin', '--delete', branch]);
      remoteDeleted = true;
    } catch {}
    return { branch, remoteDeleted };
  }

  // Checked before the switch, not left to `git checkout`'s own refusal, so the
  // error names the real reason (dirty tree vs unknown branch) rather than git's wording.
  async function checkoutBranch(branch: string): Promise<void> {
    if (!branchExists(branch)) {
      throw new Error(`Branch ${branch} does not exist`);
    }
    await assertCleanWorkingTree();
    await runGit(['checkout', branch]);
  }

  async function getLiveState(): Promise<GitLiveState> {
    const { branch, ahead, behind, entries } = await getStatusSnapshot();
    return { branch, ahead, behind, dirtyCount: entries.length };
  }

  // A branch tracking a differently named one (cut from origin/main) can't `git push`:
  // it publishes under its own name instead, which also repoints its upstream.
  async function push(): Promise<void> {
    const branch = getCurrentBranch();
    const upstream = await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'])
      .then((out) => out.trim())
      .catch(() => null);
    if (upstream === `origin/${branch}`) {
      await runGit(['push']);
    } else {
      await runGit(['push', '--set-upstream', 'origin', branch]);
    }
  }

  function getCurrentBranch(): string {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    return result.stdout.toString().trim();
  }

  // Local main only advances on checkout+pull, so compare against origin/main when it
  // exists. Cached for the manager's lifetime since remote presence never changes.
  let mainRefPromise: Promise<string> | undefined;
  function mainRef(): Promise<string> {
    if (!mainRefPromise) {
      mainRefPromise = runGit(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'])
        .then(() => 'origin/main')
        .catch(() => 'main');
    }
    return mainRefPromise;
  }

  async function originMainSha(): Promise<string | null> {
    return runGit(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'])
      .then((out) => out.trim())
      .catch(() => null);
  }

  let lastOriginMainFetch = 0;
  // Fire-and-forget so a status poll never blocks on the network; the next poll
  // (SSE-driven, frequent) reads the refreshed ref.
  function refreshOriginMainQuietly(): void {
    if (Date.now() - lastOriginMainFetch < 60_000) return;
    lastOriginMainFetch = Date.now();
    void (async () => {
      const before = await originMainSha();
      await runGit(['fetch', 'origin', 'main']).catch(() => {});
      const after = await originMainSha();
      if (after && after !== before) onRemoteChanged?.();
    })();
  }

  // Entity files are branch-local, so a ref's phase state can only be read from that
  // ref's own tree — a working-tree read would show the current branch's state instead.
  async function getPhaseStateAtRef(id: string, ref: string): Promise<PhaseState> {
    let content: string;
    try {
      content = await runGit(['show', `${ref}:papercamp/ideas/${id}.md`]);
    } catch {
      return null;
    }
    const entity = parseEntityFile(content).entries[0];
    if (!entity) return null;
    return {
      done: entity.phases.filter((phase) => phase.done).length,
      total: entity.phases.length,
    };
  }

  // Flags a ref whose total done-phase count exceeds HEAD's, regardless of which
  // specific phases moved — HEAD is about to fork from a base that's already ahead.
  async function findStaleBaseRef(id: string): Promise<StaleBaseRef | null> {
    const current = await getPhaseStateAtRef(id, 'HEAD');
    if (!current) return null;
    for (const ref of ['main', 'origin/main']) {
      const state = await getPhaseStateAtRef(id, ref);
      if (state && state.done > current.done) {
        return { ref, done: state.done, total: state.total };
      }
    }
    return null;
  }

  // The daemon rewrites papercamp/ on its own schedule, so inside the corpus only a
  // file naming this idea counts as unfinished work.
  function blocksCompletion(entry: GitStatusEntry, id: string): boolean {
    if (!entry.path.startsWith('papercamp/')) return true;
    return entry.path.includes(`${id}.md`);
  }

  // Both a clean tree and a commit-on-main are checked (not short-circuited) so the
  // report names everything still missing, not just the first failure.
  async function verifyDirectCompletion(id: string): Promise<DirectCompletionCheck> {
    const missing: string[] = [];
    const status = await runGitStatus({ untrackedFiles: 'all' });
    if (status.some((entry) => blocksCompletion(entry, id))) missing.push('a clean working tree');
    const commits = await runGit(['log', await mainRef(), '--grep', id, '--format=%H', '-1']).catch(
      () => '',
    );
    if (!commits.trim()) missing.push(`a commit for ${id} on main`);
    return { ready: missing.length === 0, missing };
  }

  // `git rev-list --left-right --count <ref>...HEAD`: left is behind, right is ahead —
  // one spawn answers both against the same ref.
  async function divergenceAgainst(ref: string): Promise<{ ahead: number; behind: number }> {
    const output = await runGit(['rev-list', '--left-right', '--count', `${ref}...HEAD`]);
    const [behind, ahead] = output
      .trim()
      .split(/\s+/)
      .map((n) => Number.parseInt(n, 10) || 0);
    return { ahead, behind };
  }

  // Squash-merge drops the branch's commits from `main`, so an ancestry check can't
  // see it — the PR's own state is the only signal left.
  async function isBranchMerged(aheadCount: number): Promise<boolean> {
    const entityId = getFeatureBranchPlanId();
    if (!entityId) return aheadCount === 0;
    const prs = await resolvePrsByEntity(root);
    if (prs === undefined) return aheadCount === 0;
    return prs.get(entityId)?.state === 'merged';
  }

  async function getBranchHygieneStatus(
    snapshot: StatusSnapshot,
  ): Promise<{ status: BranchHygieneStatus; ahead: number; behind: number }> {
    refreshOriginMainQuietly();
    const currentBranch = snapshot.branch;
    const isDirty = snapshot.entries.length > 0;

    if (currentBranch === 'main' || currentBranch === 'master') {
      return {
        status: isDirty ? 'dirty' : 'clean-on-main',
        ahead: snapshot.ahead,
        behind: snapshot.behind,
      };
    }

    const main = await mainRef();
    const { ahead, behind } = await divergenceAgainst(main);

    // "Stale" requires both merged AND main having advanced past it, not just merged.
    if (behind > 0 && (await isBranchMerged(ahead))) {
      // A fresh branch cut from a stale local `main` looks identical against origin/main
      // even though it never diverged — only divergence from the local ref is staleness.
      const neverDiverged =
        main !== 'main' &&
        (await divergenceAgainst('main').then((d) => d.ahead === 0 && d.behind === 0));
      if (!neverDiverged) {
        return { status: 'stale-merged', ahead, behind };
      }
    }

    return { status: isDirty ? 'dirty' : 'fine', ahead, behind };
  }

  function getFeatureBranchPlanId(): string | null {
    const branch = getCurrentBranch();
    const match = branch.match(/^[a-z]+\/([a-z]+-\d+)-/);
    return match ? match[1].toUpperCase() : null;
  }

  // Plain `git diff` skips untracked files, so those are read directly instead.
  async function diff(files: string[], maxChars = 12000): Promise<string> {
    if (files.length === 0) return '';
    const blocked = files.find((file) => AI_DIFF_BLOCKLIST.some((pattern) => pattern.test(file)));
    if (blocked) {
      throw new Error(`Refusing to send sensitive file "${blocked}" to commit suggestion`);
    }
    const statusEntries = await runGitStatus();
    const untracked = new Set(statusEntries.filter((e) => e.status === '??').map((e) => e.path));

    const renameSources = new Map(
      statusEntries
        .filter((e): e is GitStatusEntry & { renameSource: string } => !!e.renameSource)
        .map((e) => [e.path, e.renameSource]),
    );

    const tracked = files.filter((f) => {
      if (untracked.has(f)) return false;
      const source = renameSources.get(f);
      if (source && AI_DIFF_BLOCKLIST.some((pattern) => pattern.test(source))) return false;
      return true;
    });
    const parts: string[] = [];

    if (tracked.length > 0) {
      const trackedDiff = await runGit([
        'diff',
        'HEAD',
        '--',
        ...tracked.map(toLiteralPathspec),
      ]).catch(() => '');
      if (trackedDiff) parts.push(trackedDiff);
    }

    for (const file of files.filter((f) => untracked.has(f))) {
      const filePath = join(root, file);
      // lstat, not stat: following a symlink could leak content from outside the repo.
      const stats = await lstat(filePath).catch(() => null);
      if (!stats) continue;
      if (stats.isSymbolicLink()) {
        parts.push(`--- /dev/null\n+++ b/${file}\n(new file omitted: symlink)`);
        continue;
      }
      if (stats.size > maxChars) {
        parts.push(`--- /dev/null\n+++ b/${file}\n(new file omitted: exceeds diff size cap)`);
        continue;
      }
      const content = await readFile(filePath, 'utf-8').catch(() => '');
      if (content) {
        parts.push(`--- /dev/null\n+++ b/${file}\n(new file)\n${content}`);
      }
    }

    const combined = parts.join('\n\n');
    return combined.length > maxChars
      ? `${combined.slice(0, maxChars)}\n... (truncated)`
      : combined;
  }

  // Diffs against HEAD, so a partially-staged file's index and worktree changes
  // combine into one patch — same behavior as `diff`, just split per file with stats.
  async function getWorkingDiff(maxCharsPerFile = 20000): Promise<FileDiffEntry[]> {
    const statusEntries = await runGitStatus();
    const results: FileDiffEntry[] = [];

    for (const entry of statusEntries) {
      if (entry.status === '??') {
        const filePath = join(root, entry.path);
        // lstat, not stat: following a symlink could leak content from outside the repo.
        const stats = await lstat(filePath).catch(() => null);
        if (!stats || stats.isSymbolicLink()) {
          results.push({
            path: entry.path,
            status: entry.status,
            staged: false,
            binary: true,
            additions: 0,
            deletions: 0,
            contentKind: 'raw',
            patch: '',
          });
          continue;
        }
        if (stats.size > maxCharsPerFile) {
          results.push({
            path: entry.path,
            status: entry.status,
            staged: false,
            binary: false,
            additions: 0,
            deletions: 0,
            contentKind: 'too-large',
            patch: '',
          });
          continue;
        }
        const content = await readFile(filePath, 'utf-8').catch(() => null);
        if (content === null) {
          results.push({
            path: entry.path,
            status: entry.status,
            staged: false,
            binary: true,
            additions: 0,
            deletions: 0,
            contentKind: 'raw',
            patch: '',
          });
          continue;
        }
        results.push({
          path: entry.path,
          status: entry.status,
          staged: false,
          binary: false,
          additions: content === '' ? 0 : content.split('\n').length,
          deletions: 0,
          contentKind: 'raw',
          patch:
            content.length > maxCharsPerFile
              ? `${content.slice(0, maxCharsPerFile)}\n... (truncated)`
              : content,
        });
        continue;
      }

      // A staged rename spans two paths; scoping the diff to the new path alone
      // would miss the old path's staged deletion.
      const pathspecs = entry.renameSource ? [entry.path, entry.renameSource] : [entry.path];
      const literalPathspecs = pathspecs.map(toLiteralPathspec);
      const numstatOutput = await runGit([
        'diff',
        'HEAD',
        '--numstat',
        '--',
        ...literalPathspecs,
      ]).catch(() => '');
      // A rename below git's similarity threshold reports as two numstat lines (old
      // path deleted, new path added) rather than one — sum both, not just the first.
      const numstatLines = numstatOutput.split('\n').filter((l) => l.trim());
      const binary = numstatLines.some((l) => l.split('\t')[0] === '-');
      let additions = 0;
      let deletions = 0;
      if (!binary) {
        for (const line of numstatLines) {
          const [addRaw = '0', delRaw = '0'] = line.split('\t');
          additions += Number.parseInt(addRaw, 10) || 0;
          deletions += Number.parseInt(delRaw, 10) || 0;
        }
      }

      let patchOutput = binary
        ? ''
        : await runGit(['diff', 'HEAD', '--', ...literalPathspecs]).catch(() => '');
      // Below git's rename-similarity threshold the diff is a full delete+add; status
      // already knows it's a rename, so drop the dump for the UI's compact header.
      if (entry.renameSource && !patchOutput.includes('rename from ')) {
        patchOutput = '';
      }
      const patch =
        patchOutput.length > maxCharsPerFile
          ? `${patchOutput.slice(0, maxCharsPerFile)}\n... (truncated)`
          : patchOutput;

      results.push({
        path: entry.path,
        renameSource: entry.renameSource,
        status: entry.status,
        staged: entry.staged,
        binary,
        additions,
        deletions,
        contentKind: 'diff',
        patch,
      });
    }

    return results;
  }

  // Index writes queue behind each other: two `git add`s at once fight over
  // .git/index.lock and the loser fails with "File exists".
  let indexQueue: Promise<unknown> = Promise.resolve();
  function withIndex<T>(run: () => Promise<T>): Promise<T> {
    const next = indexQueue.then(run, run);
    indexQueue = next.catch(() => undefined);
    return next;
  }

  function stageAll(): Promise<void> {
    return withIndex(() => runGit(['add', '-A']).then(() => undefined));
  }

  function unstageAll(): Promise<void> {
    return withIndex(() => runGit(['reset', '-q']).then(() => undefined));
  }

  function stagePath(path: string): Promise<void> {
    return withIndex(() => runGit(['add', '--', toLiteralPathspec(path)]).then(() => undefined));
  }

  function unstagePath(path: string): Promise<void> {
    return withIndex(() =>
      runGit(['restore', '--staged', '--', toLiteralPathspec(path)]).then(() => undefined),
    );
  }

  async function getHeadSha(): Promise<string> {
    return (await runGit(['rev-parse', 'HEAD'])).trim();
  }

  // The porcelain line alone only carries HEAD/index blob ids, never worktree
  // content — hashing it misses a second edit to an already-modified file.
  async function getTreeHash(): Promise<string> {
    // --untracked-files=all so a brand-new directory lists its files, not just
    // the directory itself — hash-object can't hash a directory.
    const output = await runGit(['status', '--porcelain=v2', '--untracked-files=all']);
    const { entries } = parsePorcelainV2Branch(output);
    const paths = entries.filter((entry) => !entry.status.includes('D')).map((entry) => entry.path);
    const content =
      paths.length > 0 ? await runGit(['hash-object', '--stdin-paths'], paths.join('\n')) : '';
    return createHash('sha1').update(output).update(content).digest('hex');
  }

  async function getLastCommitFor(file: string): Promise<string> {
    return runGit(['log', '-1', '--format=%H', '--', toLiteralPathspec(file)])
      .then((output) => output.trim())
      .catch(() => '');
  }

  async function revert(sha: string): Promise<void> {
    try {
      await runGit(['revert', sha, '--no-edit']);
    } catch (err) {
      await runGit(['revert', '--abort']).catch(() => {});
      throw err;
    }
  }

  // The watcher re-normalizes files with the same change an incoming commit often
  // carries; those edits survive a stash but collide on pop, silently blocking sync.
  async function dropDisposableLocalChanges(): Promise<void> {
    const tracked = (await runGitStatus()).filter((entry) => !entry.status.startsWith('?'));
    const disposable: string[] = [];
    for (const entry of tracked) {
      try {
        await runGit(['diff', '--quiet', 'origin/main', '--', toLiteralPathspec(entry.path)]);
        disposable.push(entry.path);
      } catch {
        // Non-zero exit means it genuinely differs from main — keep it.
      }
    }
    if (disposable.length > 0) {
      await runGit(['checkout', 'HEAD', '--', ...disposable.map(toLiteralPathspec)]);
    }
  }

  // Fast-forwards when behind, else rebases local commits onto the remote so a
  // committed-but-unpushed change never leaves the branch split.
  const MAX_CONFLICT_CONTENT_CHARS = 20000;

  async function reconcileOnto(ref: string): Promise<void> {
    try {
      await runGit(['merge', '--ff-only', ref]);
      return;
    } catch {}
    try {
      await runGit(['rebase', ref]);
    } catch (err) {
      const conflictedFiles = (await runGitStatus())
        .filter((entry) => CONFLICT_STATUSES.has(entry.status))
        .map((entry) => entry.path);
      // A rebase can fail with no unmerged path (unstaged changes, bad ref, hook
      // rejection) — that's not a content conflict, so keep git's own error.
      if (conflictedFiles.length === 0) {
        await runGit(['rebase', '--abort']).catch(() => {});
        throw err;
      }
      // Captured before the abort below restores the pre-rebase content — this is
      // the resolve-conflict agent's only look at what the markers actually said.
      const conflictedContent = await Promise.all(
        conflictedFiles.map(async (path) => {
          const content = await readFile(join(root, path), 'utf-8').catch(() => '');
          return {
            path,
            content:
              content.length > MAX_CONFLICT_CONTENT_CHARS
                ? `${content.slice(0, MAX_CONFLICT_CONTENT_CHARS)}\n... (truncated)`
                : content,
          };
        }),
      );
      await runGit(['rebase', '--abort']).catch(() => {});
      throw new RebaseConflictError(ref, conflictedFiles, conflictedContent);
    }
  }

  // Tells a genuine rebase conflict (needs domain judgement to resolve) apart from
  // any other reconcile failure (fetch, checkout, ...), which just gets a bare message.
  function reconcileFailureFields(err: unknown):
    | {
        stage: 'conflicted';
        conflictedFiles: string[];
        conflictRef: string;
        conflictedContent: { path: string; content: string }[];
      }
    | { stage: 'reconcile' } {
    return err instanceof RebaseConflictError
      ? {
          stage: 'conflicted',
          conflictedFiles: err.conflictedFiles,
          conflictRef: err.ref,
          conflictedContent: err.conflictedContent,
        }
      : { stage: 'reconcile' };
  }

  async function runGitSync(): Promise<GitSyncResult> {
    // Fetch first: recognizing already-in-main local edits needs to know what's incoming.
    await runGit(['fetch', '--prune']).catch(() => {});
    await dropDisposableLocalChanges().catch(() => {});

    // Committed ahead of the stash below so papercamp/ never enters it; its sha is
    // captured since a plain `checkout main` won't carry the commit across branches.
    const startBranch = getCurrentBranch();
    const headBeforeCorpus = await getHeadSha();
    await commitCorpus('docs(ideas): sync corpus');
    const corpusCommit = (await getHeadSha()) !== headBeforeCorpus ? await getHeadSha() : undefined;

    const dirty = (await runGitStatus()).length > 0;
    if (dirty) {
      await runGit(['stash', 'push', '--include-untracked', '-m', 'papercamp-sync']);
    }
    let syncError: unknown;
    try {
      await runGit(['checkout', 'main']);
      if (corpusCommit && startBranch !== 'main') {
        try {
          await runGit(['cherry-pick', corpusCommit]);
        } catch (err) {
          await runGit(['cherry-pick', '--abort']).catch(() => {});
          throw err;
        }
      }
      await reconcileOnto('origin/main');
    } catch (err) {
      syncError = err;
    }
    let stashPending = dirty;
    if (dirty) {
      try {
        await runGit(['stash', 'pop', '--index']);
        stashPending = false;
      } catch {}
    }
    if (stashPending && !syncError) {
      const stage = 'stash-pop' as const;
      const message =
        'Synced to main, but restoring your changes hit a conflict. Recover with `git restore --source=origin/main --staged --worktree .` then `git merge --ff-only` — the originals are still in `git stash` if that leaves anything to redo.';
      return {
        ok: false,
        stage,
        message,
        stashPending: true,
        recoveryPrompt: buildGitSyncRecoveryPrompt(
          { stage, message, stashPending: true },
          getCurrentBranch(),
          await runGitStatus(),
        ),
      };
    }
    if (syncError) {
      const message = (syncError as Error).message;
      const failureFields = reconcileFailureFields(syncError);
      const branch = getCurrentBranch();
      return {
        ok: false,
        message,
        stashPending,
        ...failureFields,
        recoveryPrompt: buildGitSyncRecoveryPrompt(
          { ...failureFields, message, stashPending },
          branch,
          await runGitStatus(),
        ),
        ...(failureFields.stage === 'conflicted'
          ? { conflictPrompt: buildResolveConflictPrompt(failureFields, branch) }
          : {}),
      };
    }
    return { ok: true };
  }

  async function hasPendingSyncStash(): Promise<boolean> {
    const list = await runGit(['stash', 'list']).catch(() => '');
    return list.split('\n').some((line) => line.includes('papercamp-sync'));
  }

  const STASH_REFLOG_SUBJECT = /^(?:WIP on|On) ([^:]+): ?(.*)$/;
  const PAPERCAMP_STASH_MESSAGE = /^(?:papercamp-sync|sync-)/;

  async function getStashes(): Promise<GitStashEntry[]> {
    const output = await runGit(['stash', 'list', '--format=%gd%x09%ci%x09%gs']).catch(() => '');
    return output
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [selector, date, subject] = line.split('\t');
        const index = Number.parseInt(/stash@\{(\d+)\}/.exec(selector ?? '')?.[1] ?? '0', 10);
        const subjectMatch = STASH_REFLOG_SUBJECT.exec(subject ?? '');
        const message = subjectMatch?.[2] ?? subject ?? '';
        return {
          index,
          branch: subjectMatch?.[1] ?? '',
          message,
          ageDays: Math.floor((Date.now() - Date.parse(date ?? '')) / 86_400_000),
          own: PAPERCAMP_STASH_MESSAGE.test(message),
        };
      });
  }

  const STASH_DIFF_MAX_CHARS = 20000;

  async function showStash(index: number): Promise<string> {
    const patch = await runGit(['stash', 'show', '-p', '--include-untracked', `stash@{${index}}`]);
    return patch.length > STASH_DIFF_MAX_CHARS
      ? `${patch.slice(0, STASH_DIFF_MAX_CHARS)}\n... (truncated)`
      : patch;
  }

  // Reconcile the current branch: fast-forward if behind, else rebase local commits
  // onto the remote so a diverged branch is repaired instead of failing loudly.
  async function fixDivergence(strictFetch = false): Promise<GitSyncResult> {
    try {
      await runGit(['fetch', '--prune']);
    } catch (err) {
      if (strictFetch) throw new FetchFailedError((err as Error).message);
    }
    const branch = getCurrentBranch();
    try {
      const hasUpstream = await runGit([
        'rev-parse',
        '--abbrev-ref',
        '--symbolic-full-name',
        '@{u}',
      ])
        .then(() => true)
        .catch(() => false);
      await reconcileOnto(hasUpstream ? '@{u}' : await mainRef());
      return { ok: true };
    } catch (err) {
      const message = (err as Error).message;
      const failureFields = reconcileFailureFields(err);
      return {
        ok: false,
        message,
        stashPending: false,
        ...failureFields,
        recoveryPrompt: buildGitSyncRecoveryPrompt(
          { ...failureFields, message, stashPending: false },
          branch,
          await runGitStatus(),
        ),
        ...(failureFields.stage === 'conflicted'
          ? { conflictPrompt: buildResolveConflictPrompt(failureFields, branch) }
          : {}),
      };
    }
  }

  // Same operation as fixDivergence, for the plain-pull caller that wants a throw
  // on failure instead of a GitSyncResult to hand to the recovery agent.
  async function runGitPull(): Promise<void> {
    const result = await fixDivergence(true);
    if (!result.ok) throw new Error(result.message);
  }

  return {
    async getStatus(): Promise<GitStatusEntry[]> {
      return runGitStatus();
    },
    assertCleanWorkingTree,
    verifyDirectCompletion,
    returnToMain,
    getCurrentBranch,
    checkoutBranch,
    commit,
    commitCorpus,
    stageAll,
    unstageAll,
    stagePath,
    unstagePath,
    getHeadSha,
    getTreeHash,
    getLastCommitFor,
    revert,
    diff,
    getWorkingDiff,
    ensureBranch,
    findStaleBaseRef,
    getFeatureBranchPlanId,
    getStatusSnapshot,
    getLiveState,
    push,
    getBranchHygieneStatus,
    hasPendingSyncStash,
    getStashes,
    showStash,
    runGitSync,
    runGitPull,
    fixDivergence,
  };
}
