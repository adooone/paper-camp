import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
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

// Thrown by assertCleanWorkingTree so the completion action (IDEA-194) can refuse before
// merging — landing the squash-merge and only then failing to switch to main would be
// the worst outcome, so the tree is checked ahead of the merge, not after.
export class DirtyWorkingTreeError extends Error {
  files: string[];

  constructor(files: string[]) {
    super(`Working tree has uncommitted changes: ${files.join(', ')}`);
    this.files = files;
  }
}

export interface ReturnToMainResult {
  branch: string;
  remoteDeleted: boolean;
}

// Thrown by reconcileOnto so callers can tell a genuine content conflict — one that needs
// domain judgement to resolve — apart from any other reconcile failure (fetch, checkout, ...).
export class RebaseConflictError extends Error {
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

export interface GitManagerOptions {
  // Tests disable this: Node's recursive-watch fallback crashes uncatchably
  // when a watched tree is deleted (e.g. a temp repo cleanup).
  watch?: boolean;
}

export function createGitManager(root: string, options: GitManagerOptions = {}) {
  const clients = new Set<ServerResponse>();

  function broadcast(event: { message: string; timestamp: string }) {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      try {
        client.write(data);
      } catch {
        clients.delete(client);
      }
    }
  }

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

  const GIT_TIMEOUT_MS = 30_000;

  function runGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // quotepath=off: non-ASCII paths stay raw UTF-8 instead of octal-escaped,
      // which would otherwise garble every downstream pathspec.
      const proc = spawn('git', ['-c', 'core.quotepath=off', ...args], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
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
    });
  }

  function runGitStatus(): Promise<GitStatusEntry[]> {
    return runGit(['status', '--porcelain=v1']).then(parsePorcelain);
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
      const toAdd = files.filter((f) => {
        const status = statusByPath.get(f);
        return status === undefined || status[1] !== ' ';
      });
      if (toAdd.length > 0) {
        await runGit(['add', '--', ...toAdd.map(toLiteralPathspec)]);
      }
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
    await runGit(args);
  }

  // Called right after branch setup so a run can never erase the drafted plan it is
  // about to execute — see IDEA-137, and by runGitSync before stashing — see IDEA-176.
  // Scoped to papercamp/ only: unrelated dirty state outside the corpus is left for
  // the caller's own commit steps.
  async function commitCorpus(subject: string, refsId?: string): Promise<void> {
    const status = await runGitStatus();
    const files = status.filter((entry) => entry.path.startsWith('papercamp/')).map((e) => e.path);
    if (files.length === 0) return;
    await commit(files, subject, refsId ? `Refs: ${refsId}` : undefined, { noVerify: true });
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

    // Whether the branch already exists decides create-vs-checkout — never infer it
    // from a `checkout -b` failure, which also fires for a dirty/blocked worktree and
    // would then surface the misleading "pathspec did not match" from a doomed retry.
    const branchExists =
      spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: root })
        .status === 0;

    if (branchExists) {
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

    // Read before the checkout below moves HEAD — this is the cheap moment to catch a
    // stale fork (IDEA-171): the new branch is about to inherit whatever corpus state
    // HEAD carries, so warn now rather than after run-all silently redoes the work.
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

  // Called right after a successful squash-merge (IDEA-194). `git branch -d` would
  // refuse: squashing rewrites the SHA, so the branch never reads as merged into
  // main — `-D` is required, not a looser safety check being skipped.
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

  async function refresh() {
    try {
      await runGitStatus();
      broadcast({
        message: 'Working tree status updated',
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }

  if (options.watch !== false) {
    const gitDir = join(root, '.git');
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const gitWatcher = watch(gitDir, { recursive: true }, (eventType, filename) => {
        if (filename === 'index') {
          if (timer) clearTimeout(timer);
          timer = setTimeout(refresh, 500);
        }
      });
      gitWatcher.on('error', () => {});
    } catch {}

    const srcDir = join(root, 'src');
    let srcTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      const srcWatcher = watch(srcDir, { recursive: true }, () => {
        if (srcTimer) clearTimeout(srcTimer);
        srcTimer = setTimeout(refresh, 500);
      });
      srcWatcher.on('error', () => {});
    } catch {}
  }

  async function hasUpstream(): Promise<boolean> {
    try {
      await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      return true;
    } catch {
      return false;
    }
  }

  // No upstream: fall back to commits not reachable from any remote-tracking branch.
  async function getAheadCount(): Promise<number> {
    try {
      const args = (await hasUpstream())
        ? ['rev-list', '--count', '@{u}..HEAD']
        : ['rev-list', '--count', 'HEAD', '--not', '--remotes'];
      const output = await runGit(args);
      return Number.parseInt(output.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  // No upstream: fall back to commits reachable from origin/main but not HEAD, so a
  // fresh branch still reports how far behind it is.
  async function getBehindCount(): Promise<number> {
    try {
      const args = (await hasUpstream())
        ? ['rev-list', '--count', 'HEAD..@{u}']
        : ['rev-list', '--count', `HEAD..${await mainRef()}`];
      const output = await runGit(args);
      return Number.parseInt(output.trim(), 10) || 0;
    } catch {
      return 0;
    }
  }

  async function getLiveState(): Promise<GitLiveState> {
    const [entries, ahead, behind] = await Promise.all([
      runGitStatus(),
      getAheadCount(),
      getBehindCount(),
    ]);
    return { branch: getCurrentBranch(), ahead, behind, dirtyCount: entries.length };
  }

  async function push(): Promise<void> {
    if (await hasUpstream()) {
      await runGit(['push']);
    } else {
      await runGit(['push', '--set-upstream', 'origin', getCurrentBranch()]);
    }
  }

  function getCurrentBranch(): string {
    const result = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    return result.stdout.toString().trim();
  }

  // Local main only advances on checkout+pull, so a GitHub-side merge never shows
  // up there — compare against origin/main when it exists.
  async function mainRef(): Promise<string> {
    return runGit(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'])
      .then(() => 'origin/main')
      .catch(() => 'main');
  }

  let lastOriginMainFetch = 0;
  // Fire-and-forget so a status poll never blocks on the network; the next poll
  // (SSE-driven, frequent) reads the refreshed ref.
  function refreshOriginMainQuietly(): void {
    if (Date.now() - lastOriginMainFetch < 60_000) return;
    lastOriginMainFetch = Date.now();
    void runGit(['fetch', 'origin', 'main']).catch(() => {});
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

  // Refuses a stale fork: main or origin/main already has phases checked that HEAD (the
  // branch about to run) still shows unchecked — the IDEA-137 bug class. Compares total
  // done counts, not per-phase identity: a ref simply further along than HEAD is enough
  // to flag, regardless of which specific phases moved.
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

  async function isMergedIntoMain(): Promise<boolean> {
    const currentBranch = getCurrentBranch();
    if (currentBranch === 'main' || currentBranch === 'master') return false;

    try {
      const mergedBranches = await runGit(['branch', '--merged', await mainRef()]);
      return mergedBranches.split('\n').some((line) => {
        const branch = line.trim().replace(/^\*\s+/, '');
        return branch === currentBranch;
      });
    } catch {
      return false;
    }
  }

  // Squash-merge deletes the branch and drops its commits from `main`, so
  // ancestry (`isMergedIntoMain`) never sees a squashed branch as merged; the
  // PR's own state is the only signal that survives the squash.
  async function isBranchMerged(): Promise<boolean> {
    const entityId = getFeatureBranchPlanId();
    if (!entityId) return isMergedIntoMain();
    const prs = await resolvePrsByEntity(root);
    if (prs === undefined) return isMergedIntoMain();
    return prs.get(entityId)?.state === 'merged';
  }

  async function getBranchHygieneStatus(): Promise<BranchHygieneStatus> {
    refreshOriginMainQuietly();
    const currentBranch = getCurrentBranch();
    const status = await runGitStatus();
    const isDirty = status.length > 0;

    if (currentBranch === 'main' || currentBranch === 'master') {
      return isDirty ? 'dirty' : 'clean-on-main';
    }

    // "Stale" requires both merged AND main having advanced past it, not just merged.
    if (await isBranchMerged()) {
      // A fresh branch cut from a stale local main is an ancestor of origin/main
      // with zero commits of its own — "not started", never "merged".
      const [head, mainTip] = await Promise.all([
        runGit(['rev-parse', 'HEAD']).catch(() => ''),
        runGit(['rev-parse', 'main']).catch(() => ''),
      ]);
      if (head && head.trim() !== mainTip.trim()) {
        const behind = await runGit(['rev-list', '--count', `HEAD..${await mainRef()}`])
          .then((n) => Number.parseInt(n.trim(), 10) || 0)
          .catch(() => 0);
        if (behind > 0) return 'stale-merged';
      }
    }

    return isDirty ? 'dirty' : 'fine';
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
      // Below git's rename-similarity threshold, the "diff" is a full delete of the old
      // path plus a full add of the new one — a full re-add. We already know from status
      // that it's a rename, so drop the dump in favor of the compact header the UI shows.
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

  async function stageAll(): Promise<void> {
    await runGit(['add', '-A']);
  }

  async function stagePath(path: string): Promise<void> {
    await runGit(['add', '--', toLiteralPathspec(path)]);
  }

  async function unstagePath(path: string): Promise<void> {
    await runGit(['restore', '--staged', '--', toLiteralPathspec(path)]);
  }

  async function getHeadSha(): Promise<string> {
    return (await runGit(['rev-parse', 'HEAD'])).trim();
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

  // `papercamp/run-order.md` used to be listed here as disposable; it's gitignored
  // now, so it never reaches `runGitStatus()` at all.
  //
  // The watcher rewrites files and re-normalizes `order:`, often with the same change an
  // incoming commit carries; those edits survive the stash but collide on pop, silently
  // blocking sync. Drop the disposable ones: identical-to-origin/main loses nothing.
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

  // Trunk-style reconcile: fast-forward when the local ref is merely behind, else
  // replay the local (direct-to-main) commits on top of the squash-merged remote so
  // a committed-but-unpushed change never leaves the branch split. A genuine content
  // conflict aborts the rebase cleanly and surfaces, rather than dumping markers.
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

    // Committed here, ahead of the stash below, so papercamp/ never enters it — see
    // IDEA-176. A commit made on a branch other than main doesn't travel with a plain
    // `checkout main`, so its sha is captured to cherry-pick across below.
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
  async function runGitPull(): Promise<void> {
    await runGit(['fetch', '--prune']);
    const branch = getCurrentBranch();
    await reconcileOnto(`origin/${branch}`);
  }

  // Same rebase-then-report path as runGitPull, but returns a GitSyncResult
  // (with a recovery prompt on failure) instead of throwing, so the caller can
  // hand a conflict to the recovery agent the way runGitSync already does.
  async function fixDivergence(): Promise<GitSyncResult> {
    await runGit(['fetch', '--prune']).catch(() => {});
    const branch = getCurrentBranch();
    try {
      const ref = (await hasUpstream()) ? '@{u}' : await mainRef();
      await reconcileOnto(ref);
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

  return {
    async getStatus(): Promise<GitStatusEntry[]> {
      return runGitStatus();
    },
    assertCleanWorkingTree,
    returnToMain,
    getCurrentBranch,
    commit,
    commitCorpus,
    stageAll,
    stagePath,
    unstagePath,
    getHeadSha,
    getLastCommitFor,
    revert,
    diff,
    getWorkingDiff,
    ensureBranch,
    getPhaseStateAtRef,
    findStaleBaseRef,
    getFeatureBranchPlanId,
    getAheadCount,
    getBehindCount,
    getLiveState,
    push,
    isMergedIntoMain,
    getBranchHygieneStatus,
    hasPendingSyncStash,
    getStashes,
    showStash,
    runGitSync,
    runGitPull,
    fixDivergence,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
