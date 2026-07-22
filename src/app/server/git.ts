import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import { branchName } from '@/core/git-pr';
import type { BranchHygieneStatus, GitStatusEntry, PlanEntry } from '../../types';

const AI_DIFF_BLOCKLIST = [/(^|\/)\.env(\.|$)/i, /\.(pem|key|p12|crt)$/i];

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

  function runGit(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // quotepath=off: non-ASCII paths stay raw UTF-8 instead of octal-escaped,
      // which would otherwise garble every downstream pathspec.
      const proc = spawn('git', ['-c', 'core.quotepath=off', ...args], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      proc.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || stdout || `git ${args[0]} exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });
  }

  function runGitStatus(): Promise<GitStatusEntry[]> {
    return runGit(['status', '--porcelain=v1']).then(parsePorcelain);
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

  function ensureBranch(plan: PlanEntry): void {
    const branch = branchName(plan.id, plan.kind, plan.title);
    if (!branch) return;

    const currentResult = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    if (currentResult.status !== 0) {
      throw new Error(
        currentResult.stderr.toString().trim() || 'Unable to read current git branch',
      );
    }
    const currentBranch = currentResult.stdout.toString().trim();
    if (currentBranch === branch) return;

    const result = spawnSync('git', ['checkout', '-b', branch, 'main'], { cwd: root });
    if (result.status !== 0) {
      // Branch already exists — just check it out.
      const checkoutResult = spawnSync('git', ['checkout', branch], { cwd: root });
      if (checkoutResult.status !== 0) {
        throw new Error(
          checkoutResult.stderr.toString().trim() ||
            result.stderr.toString().trim() ||
            `Unable to check out ${branch}`,
        );
      }
    }
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
      watch(gitDir, { recursive: true }, (eventType, filename) => {
        if (filename === 'index') {
          if (timer) clearTimeout(timer);
          timer = setTimeout(refresh, 500);
        }
      });
    } catch {}

    const srcDir = join(root, 'src');
    let srcTimer: ReturnType<typeof setTimeout> | null = null;
    try {
      watch(srcDir, { recursive: true }, () => {
        if (srcTimer) clearTimeout(srcTimer);
        srcTimer = setTimeout(refresh, 500);
      });
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

  async function getBranchHygieneStatus(): Promise<BranchHygieneStatus> {
    refreshOriginMainQuietly();
    const currentBranch = getCurrentBranch();
    const status = await runGitStatus();
    const isDirty = status.length > 0;

    if (currentBranch === 'main' || currentBranch === 'master') {
      return isDirty ? 'dirty' : 'clean-on-main';
    }

    // "Stale" requires both merged AND main having advanced past it, not just merged.
    if (await isMergedIntoMain()) {
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

  async function stageAll(): Promise<void> {
    await runGit(['add', '-A']);
  }

  async function runGitSync(): Promise<void> {
    const dirty = (await runGitStatus()).length > 0;
    if (dirty) {
      await runGit(['stash', 'push', '--include-untracked', '-m', 'papercamp-sync']);
    }
    let syncError: unknown;
    try {
      await runGit(['checkout', 'main']);
      await runGit(['fetch', '--prune']);
      await runGit(['merge', '--ff-only', 'origin/main']);
    } catch (err) {
      syncError = err;
    }
    if (dirty) {
      try {
        await runGit(['stash', 'pop', '--index']);
      } catch {
        if (!syncError) {
          throw new Error(
            'Synced to main, but restoring your changes hit a conflict — resolve the markers in the working tree; the originals are still in `git stash`',
          );
        }
      }
    }
    if (syncError) throw syncError;
  }

  // Fast-forward only, so a diverged branch fails loudly instead of merging.
  async function runGitPull(): Promise<void> {
    await runGit(['fetch', '--prune']);
    const branch = getCurrentBranch();
    await runGit(['merge', '--ff-only', `origin/${branch}`]);
  }

  return {
    async getStatus(): Promise<GitStatusEntry[]> {
      return runGitStatus();
    },
    getCurrentBranch,
    commit,
    stageAll,
    diff,
    ensureBranch,
    getFeatureBranchPlanId,
    getAheadCount,
    push,
    isMergedIntoMain,
    getBranchHygieneStatus,
    runGitSync,
    runGitPull,
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
