import { spawn } from 'node:child_process';

interface PrCacheEntry {
  merged: boolean | undefined;
  fetchedAt: number;
}

const cache = new Map<string, PrCacheEntry>();

/**
 * Cache window for a resolved PR merge state — long enough that a worklist
 * read doesn't re-shell out to `gh` on every request, short enough that a
 * merge shows up as `done` within the same working session.
 */
export const PR_CACHE_TTL_MS = 5 * 60 * 1000;

function runGhPrList(root: string, branch: string): Promise<boolean | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'state', '--limit', '1'],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => {
      // Non-zero covers "no gh binary", "not authenticated", "offline", and
      // "not a GitHub remote" alike — all of them mean "can't resolve", not
      // "not merged", so the caller must fall back rather than treat this as
      // a confirmed non-merge.
      if (code !== 0) {
        resolve(undefined);
        return;
      }
      try {
        const rows = JSON.parse(stdout) as Array<{ state: string }>;
        resolve(rows[0]?.state === 'MERGED');
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

/**
 * Whether `branch`'s PR (if any) is merged, resolved via a live `gh` lookup
 * and cached for `ttlMs` — see IDEA-56 phase 3. Uses `gh pr list --head` (not
 * `gh pr view`) so a squash-merged branch that's already been deleted locally
 * still resolves: GitHub keeps the PR's recorded head branch name after the
 * branch itself is gone.
 *
 * Returns `undefined` when the lookup couldn't be resolved at all (no `gh`,
 * not authenticated, offline, ...) — callers fall back to the stored
 * override in that case. Returns `false` (not `undefined`) when `gh` ran
 * successfully but found no matching PR, since that's a confirmed answer.
 */
export async function resolvePrMerged(
  root: string,
  branch: string,
  ttlMs = PR_CACHE_TTL_MS,
): Promise<boolean | undefined> {
  const cached = cache.get(branch);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.merged;
  const merged = await runGhPrList(root, branch);
  cache.set(branch, { merged, fetchedAt: Date.now() });
  return merged;
}

/** Test-only: clears the module-level PR cache between test cases. */
export function clearPrCache(): void {
  cache.clear();
}
