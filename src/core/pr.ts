import { spawn } from 'node:child_process';
import type { PrInfo } from '../types/index';

interface PrCacheEntry {
  /** `null` = `gh` ran successfully and found no matching PR (confirmed). */
  info: PrInfo | null | undefined;
  fetchedAt: number;
}

const cache = new Map<string, PrCacheEntry>();

/**
 * Cache window for a resolved PR — long enough that a worklist read doesn't
 * re-shell out to `gh` on every request, short enough that a merge or state
 * change shows up within the same working session.
 */
export const PR_CACHE_TTL_MS = 5 * 60 * 1000;

interface GhPrRow {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
}

function toPrInfo(row: GhPrRow): PrInfo {
  const state: PrInfo['state'] =
    row.state === 'MERGED'
      ? 'merged'
      : row.state === 'CLOSED'
        ? 'closed'
        : row.isDraft
          ? 'draft'
          : 'open';
  return { number: row.number, url: row.url, state };
}

function runGhPrList(root: string, branch: string): Promise<PrInfo | null | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      [
        'pr',
        'list',
        '--head',
        branch,
        '--state',
        'all',
        '--json',
        'number,url,state,isDraft',
        '--limit',
        '1',
      ],
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
        const rows = JSON.parse(stdout) as GhPrRow[];
        resolve(rows[0] ? toPrInfo(rows[0]) : null);
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

async function cachedPrInfo(
  root: string,
  branch: string,
  ttlMs: number,
): Promise<PrInfo | null | undefined> {
  // Key by root+branch: a long-lived process (server/MCP) can resolve PRs for more
  // than one repo, and branch names collide across repos.
  const key = `${root}::${branch}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.info;
  const info = await runGhPrList(root, branch);
  cache.set(key, { info, fetchedAt: Date.now() });
  return info;
}

/**
 * Live-resolves `branch`'s PR (number, url, draft/open/closed/merged state),
 * cached for `ttlMs` — the source for the UI's PR badge. `undefined` means
 * either no matching PR or the lookup couldn't be resolved at all (no `gh`,
 * not authenticated, offline, ...); either way there's nothing to render.
 */
export async function resolvePrInfo(
  root: string,
  branch: string,
  ttlMs = PR_CACHE_TTL_MS,
): Promise<PrInfo | undefined> {
  const info = await cachedPrInfo(root, branch, ttlMs);
  return info ?? undefined;
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
  const info = await cachedPrInfo(root, branch, ttlMs);
  return info === undefined ? undefined : info?.state === 'merged';
}

/** Test-only: clears the module-level PR cache between test cases. */
export function clearPrCache(): void {
  cache.clear();
}
