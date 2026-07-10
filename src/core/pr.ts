import { spawn } from 'node:child_process';
import type { PrInfo, ReviewDecision, ReviewThread } from '../types/index';

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
  reviewDecision: string;
}

const REVIEW_DECISION: Record<string, ReviewDecision> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'changes-requested',
  REVIEW_REQUIRED: 'review-required',
};

function toPrInfo(row: GhPrRow): PrInfo {
  const state: PrInfo['state'] =
    row.state === 'MERGED'
      ? 'merged'
      : row.state === 'CLOSED'
        ? 'closed'
        : row.isDraft
          ? 'draft'
          : 'open';
  const reviewDecision = REVIEW_DECISION[row.reviewDecision];
  return { number: row.number, url: row.url, state, ...(reviewDecision && { reviewDecision }) };
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

interface ReviewSignal {
  unresolvedThreadCount: number;
  hasNewCommentsSincePush: boolean;
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) { nodes { isResolved } }
      commits(last: 1) { nodes { commit { committedDate } } }
      comments(last: 1) { nodes { createdAt } }
      reviews(last: 1) { nodes { createdAt } }
    }
  }
}`;

interface GraphqlPullRequest {
  reviewThreads: { nodes: { isResolved: boolean }[] };
  commits: { nodes: { commit: { committedDate: string } }[] };
  comments: { nodes: { createdAt: string }[] };
  reviews: { nodes: { createdAt: string }[] };
}

/** Splits a PR's `html_url` into the owner/repo/number a `gh api graphql` call needs. */
function parsePrUrl(url: string): { owner: string; repo: string; number: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, number] = match;
  return { owner, repo, number };
}

/** Shared `gh api graphql` runner: resolves `undefined` on any spawn/exit/parse failure. */
function runGhApiGraphql<T>(
  root: string,
  query: string,
  owner: string,
  repo: string,
  number: string,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      [
        'api',
        'graphql',
        '-f',
        `query=${query}`,
        '-f',
        `owner=${owner}`,
        '-f',
        `repo=${repo}`,
        '-F',
        `number=${number}`,
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => {
      if (code !== 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(stdout) as T);
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

/**
 * `gh pr list` has no field for review-thread resolution or activity timing, so
 * this is the one `gh api` call the list pass can't fold in — run only for
 * open/draft PRs (a merged/closed PR has no review loop left to surface).
 */
async function fetchReviewSignal(root: string, url: string): Promise<ReviewSignal | undefined> {
  const parsed = parsePrUrl(url);
  if (!parsed) return undefined;
  const data = await runGhApiGraphql<{
    data?: { repository?: { pullRequest?: GraphqlPullRequest } };
  }>(root, REVIEW_THREADS_QUERY, parsed.owner, parsed.repo, parsed.number);
  const pr = data?.data?.repository?.pullRequest;
  if (!pr) return undefined;
  const unresolvedThreadCount = pr.reviewThreads.nodes.filter((n) => !n.isResolved).length;
  const pushedAt = pr.commits.nodes[0]?.commit.committedDate;
  const latestActivity = [pr.comments.nodes[0]?.createdAt, pr.reviews.nodes[0]?.createdAt]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const hasNewCommentsSincePush = Boolean(pushedAt && latestActivity && latestActivity > pushedAt);
  return { unresolvedThreadCount, hasNewCommentsSincePush };
}

const REVIEW_THREAD_COMMENTS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 1) { nodes { path line body author { login } } }
        }
      }
    }
  }
}`;

interface GraphqlThreadComment {
  path?: string | null;
  line?: number | null;
  body: string;
  author?: { login: string } | null;
}

interface GraphqlThreadNode {
  isResolved: boolean;
  comments: { nodes: GraphqlThreadComment[] };
}

/**
 * Per-comment detail for a PR's unresolved review threads, for the fix-review
 * launch path (`POST /api/agent/launch-fix-review`) to hand to
 * `buildFixReviewPrompt`. Each thread is represented by its first comment, since
 * that's the one that states what needs fixing. Best-effort: resolves `[]` on
 * any failure so a launch with no readable threads falls back to
 * `buildFixReviewPrompt`'s own empty-threads guard rather than erroring out.
 */
export async function fetchUnresolvedThreads(root: string, url: string): Promise<ReviewThread[]> {
  const parsed = parsePrUrl(url);
  if (!parsed) return [];
  const data = await runGhApiGraphql<{
    data?: { repository?: { pullRequest?: { reviewThreads: { nodes: GraphqlThreadNode[] } } } };
  }>(root, REVIEW_THREAD_COMMENTS_QUERY, parsed.owner, parsed.repo, parsed.number);
  const nodes = data?.data?.repository?.pullRequest?.reviewThreads.nodes ?? [];
  return nodes
    .filter((n) => !n.isResolved)
    .map((n) => n.comments.nodes[0])
    .filter((c): c is GraphqlThreadComment => Boolean(c))
    .map((c) => ({
      ...(c.path ? { path: c.path } : {}),
      ...(c.line != null ? { line: c.line } : {}),
      ...(c.author?.login ? { author: c.author.login } : {}),
      body: c.body,
    }));
}

/** Best-effort: enriches open/draft entries in place with review-thread signal. */
async function enrichWithReviewSignal(root: string, byId: Map<string, PrInfo>): Promise<void> {
  const active = [...byId.entries()].filter(
    ([, info]) => info.state === 'open' || info.state === 'draft',
  );
  const signals = await Promise.all(active.map(([, info]) => fetchReviewSignal(root, info.url)));
  active.forEach(([id, info], i) => {
    const signal = signals[i];
    if (signal) byId.set(id, { ...info, ...signal });
  });
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
        'number,url,state,isDraft,headRefName,body,reviewDecision',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    // Drain stderr — an unread pipe can fill and hang the subprocess.
    proc.stderr?.on('data', () => {});
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
        enrichWithReviewSignal(root, byId).then(() => resolve(byId));
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
  // Only cache a successful resolution — caching an `undefined` (transient gh
  // failure, offline) would pin the whole worklist to stored status for the full
  // TTL instead of retrying on the next read.
  if (prs !== undefined) cache.set(root, { prs, fetchedAt: Date.now() });
  return prs;
}

/** Test-only: clears the module-level PR cache between test cases. */
export function clearPrCache(): void {
  cache.clear();
}
