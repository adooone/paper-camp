import { spawn } from 'node:child_process';
import type { PrInfo } from '../types/index';

interface PrMapCacheEntry {
  /** A `Map` (possibly empty) once `gh` resolved; `undefined` = couldn't resolve. */
  prs: Map<string, PrInfo> | undefined;
  fetchedAt: number;
}

// Keyed by repo root: a long-lived process (server/MCP) can serve more than one repo.
const cache = new Map<string, PrMapCacheEntry>();

/**
 * Cache window for the resolved PR set — long enough that a worklist read doesn't
 * re-shell out to `gh` on every request, short enough that a merge or state
 * change shows up within the same working session.
 */
export const PR_CACHE_TTL_MS = 5 * 60 * 1000;

interface GhPrRow {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  body: string;
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

// When an entity has more than one PR, the most-advanced wins: a merge beats an
// open reattempt beats a draft beats an abandoned close.
const STATE_RANK: Record<PrInfo['state'], number> = { merged: 4, open: 3, draft: 2, closed: 1 };

/**
 * The entity id a PR references — its `**Plan:** \`IDEA-N\`` body line (stamped
 * by draft-pr.yml), falling back to the `feat/idea-N-…` id prefix of its head
 * branch. Both key off the stable id, never the title, so a renamed entity's PR
 * still resolves.
 */
function prEntityId(row: GhPrRow): string | null {
  const fromBody = row.body?.match(/\*\*Plan:\*\*\s*`?([A-Za-z]+-\d+)`?/);
  if (fromBody) return fromBody[1].toUpperCase();
  const fromBranch = row.headRefName?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return fromBranch ? fromBranch[1].toUpperCase() : null;
}

function runGhPrListAll(root: string): Promise<Map<string, PrInfo> | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      [
        'pr',
        'list',
        '--state',
        'all',
        // High cap rather than pagination: one entity maps to one PR, so this
        // only matters for repos with thousands of PRs. An entity whose PR falls
        // past the cap simply has no live signal and falls back to stored status.
        '--limit',
        '2000',
        '--json',
        'number,url,state,isDraft,headRefName,body',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.on('close', (code) => {
      // Non-zero covers "no gh binary", "not authenticated", "offline", and "not
      // a GitHub remote" alike — all mean "can't resolve", not "no PRs", so the
      // caller must fall back rather than treat this as a confirmed empty set.
      if (code !== 0) {
        resolve(undefined);
        return;
      }
      try {
        const rows = JSON.parse(stdout) as GhPrRow[];
        const byId = new Map<string, PrInfo>();
        for (const row of rows) {
          const id = prEntityId(row);
          if (!id) continue;
          const info = toPrInfo(row);
          const existing = byId.get(id);
          if (!existing || STATE_RANK[info.state] > STATE_RANK[existing.state]) {
            byId.set(id, info);
          }
        }
        resolve(byId);
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

/**
 * Every PR in the repo indexed by the entity id it references, resolved via a
 * single `gh pr list` and cached for `ttlMs` — see IDEA-56's PR-driven status
 * derivation. `undefined` when the lookup can't resolve at all (no `gh`, not
 * authenticated, offline, no GitHub remote); callers fall back to stored status.
 * An entity simply absent from the returned map has no PR (a confirmed answer).
 */
export async function resolvePrsByEntity(
  root: string,
  ttlMs = PR_CACHE_TTL_MS,
): Promise<Map<string, PrInfo> | undefined> {
  const cached = cache.get(root);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.prs;
  const prs = await runGhPrListAll(root);
  cache.set(root, { prs, fetchedAt: Date.now() });
  return prs;
}

/** Test-only: clears the module-level PR cache between test cases. */
export function clearPrCache(): void {
  cache.clear();
}
