import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { join } from 'node:path';
import type { BranchHygieneStatus, GitStatusEntry, PlanEntry } from '../../types';

const AI_DIFF_BLOCKLIST = [/(^|\/)\.env(\.|$)/i, /\.(pem|key|p12|crt)$/i];

// Git expands pathspec magic (e.g. `:/`) even after `--`, which can broaden a
// command beyond the caller-selected files. Force every API-supplied path to be
// treated literally so selections can't widen to unrelated files.
const toLiteralPathspec = (file: string) => `:(literal)${file}`;

export type GitManager = ReturnType<typeof createGitManager>;

export function createGitManager(root: string) {
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
      const proc = spawn('git', args, {
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
          reject(new Error(stderr || `git ${args[0]} exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });
  }

  function runGitStatus(): Promise<GitStatusEntry[]> {
    return runGit(['status', '--porcelain=v1']).then(parsePorcelain);
  }

  async function commit(files: string[], title: string, message?: string): Promise<void> {
    if (files.length > 0) {
      const statusEntries = await runGitStatus();
      const statusByPath = new Map(statusEntries.map((e) => [e.path, e.status]));
      // Files already fully staged (no pending worktree change) have nothing left for
      // `git add` to match — passing them anyway makes git fail with "did not match any files".
      const toAdd = files.filter((f) => {
        const status = statusByPath.get(f);
        return status === undefined || status[1] !== ' ';
      });
      if (toAdd.length > 0) {
        await runGit(['add', '--', ...toAdd.map(toLiteralPathspec)]);
      }
    }
    const args = ['commit', '-m', title];
    if (message) args.push('-m', message);
    // Restrict the commit to the selected files so unrelated already-staged
    // paths aren't swept in; an empty selection falls through to "commit
    // whatever's staged", which is the intended behavior for that case.
    if (files.length > 0) {
      args.push('--', ...files.map(toLiteralPathspec));
    }
    await runGit(args);
  }

  function ensureBranch(plan: PlanEntry): void {
    if (!plan.kind || !plan.id) return;

    const kind = plan.kind.toLowerCase();
    const id = plan.id.toLowerCase();
    const title = plan.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const branch = `${kind}/${id}-${title}`;

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
      // Branch already exists — just check it out
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
    } catch {
      // git not available or not a repo
    }
  }

  const gitDir = join(root, '.git');
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    watch(gitDir, { recursive: true }, (eventType, filename) => {
      if (filename === 'index') {
        if (timer) clearTimeout(timer);
        timer = setTimeout(refresh, 500);
      }
    });
  } catch {
    // watcher not available
  }

  const srcDir = join(root, 'src');
  let srcTimer: ReturnType<typeof setTimeout> | null = null;
  try {
    watch(srcDir, { recursive: true }, () => {
      if (srcTimer) clearTimeout(srcTimer);
      srcTimer = setTimeout(refresh, 500);
    });
  } catch {
    // src/ doesn't exist or watcher not available
  }

  async function hasUpstream(): Promise<boolean> {
    try {
      await runGit(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
      return true;
    } catch {
      return false;
    }
  }

  // Counts commits on HEAD not yet on the upstream branch. When no upstream is
  // configured (e.g. a fresh branch that's never been pushed), every local commit
  // not reachable from any remote-tracking branch counts as ahead.
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

  async function isMergedIntoMain(): Promise<boolean> {
    const currentBranch = getCurrentBranch();
    if (currentBranch === 'main' || currentBranch === 'master') return false;

    try {
      // Merged status only — the upstream check lives in getBranchHygieneStatus so
      // it can tell 'stale-merged' apart from 'stale-no-upstream'. Conflating them
      // here missed the common case: a pushed branch merged via PR (still has an
      // upstream) would never report 'stale-merged'.
      const mergedBranches = await runGit(['branch', '--merged', 'main']);
      return mergedBranches.split('\n').some((line) => {
        const branch = line.trim().replace(/^\*\s+/, '');
        return branch === currentBranch;
      });
    } catch {
      return false;
    }
  }

  async function getBranchHygieneStatus(): Promise<BranchHygieneStatus> {
    const currentBranch = getCurrentBranch();
    const status = await runGitStatus();
    const isDirty = status.length > 0;

    if (currentBranch === 'main' || currentBranch === 'master') {
      return isDirty ? 'dirty' : 'clean-on-main';
    }

    // Only "stale" if the branch is fully merged into main AND main has advanced
    // past it — i.e. its work is done and elsewhere. A freshly-created branch still
    // at main's tip, or one with un-merged local work (with or without an upstream),
    // is normal active work, not stale.
    if (await isMergedIntoMain()) {
      const behind = await runGit(['rev-list', '--count', 'HEAD..main'])
        .then((n) => Number.parseInt(n.trim(), 10) || 0)
        .catch(() => 0);
      if (behind > 0) return 'stale-merged';
    }

    return isDirty ? 'dirty' : 'fine';
  }

  function getFeatureBranchPlanId(): string | null {
    const branch = getCurrentBranch();
    const match = branch.match(/^[a-z]+\/([a-z]+-\d+)-/);
    return match ? match[1].toUpperCase() : null;
  }

  /**
   * Diff text for the given paths, capped to a sane size for feeding into a prompt.
   * Plain `git diff` skips untracked files entirely, so those are read directly and
   * presented as new-file content instead.
   */
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
      // lstat (not stat) so a symlink is identified as such instead of followed —
      // otherwise its target's content, possibly outside the repo, leaks into the AI prompt.
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
    // Clean sync: checkout main, fetch, and fast-forward merge
    await runGit(['checkout', 'main']);
    await runGit(['fetch', '--prune']);
    await runGit(['merge', '--ff-only', 'origin/main']);
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
    subscribe(res: ServerResponse) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
  };
}
