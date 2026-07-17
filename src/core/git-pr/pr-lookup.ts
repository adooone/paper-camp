import { spawn } from 'node:child_process';
import type { PrInfo, ReviewDecision, ReviewThread } from '../../types/index';

interface PrMapCacheEntry {
  /** `undefined` means `gh` couldn't resolve, distinct from a resolved-but-empty `Map`. */
  prs: Map<string, PrInfo> | undefined;
  fetchedAt: number;
}

const cache = new Map<string, PrMapCacheEntry>();

const PR_CACHE_TTL_MS = 5 * 60 * 1000;

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

const STATE_RANK: Record<PrInfo['state'], number> = { merged: 4, open: 3, draft: 2, closed: 1 };

export function resolveEntityIdFromPrRef(
  body: string | null | undefined,
  branch: string | null | undefined,
): string | null {
  const fromBody = body?.match(/\*\*Plan:\*\*\s*`?([A-Za-z]+-\d+)`?/);
  if (fromBody) return fromBody[1].toUpperCase();
  const fromBranch = branch?.match(/^[a-z]+\/([a-z]+-\d+)-/);
  return fromBranch ? fromBranch[1].toUpperCase() : null;
}

function prEntityId(row: GhPrRow): string | null {
  return resolveEntityIdFromPrRef(row.body, row.headRefName);
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

export function parsePrUrl(url: string): { owner: string; repo: string; number: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, number] = match;
  return { owner, repo, number };
}

const GH_API_TIMEOUT_MS = 15_000;

/** Resolves `undefined` on any spawn/exit/parse failure — never throws. */
function runGhApiGraphql<T>(
  root: string,
  query: string,
  owner: string,
  repo: string,
  number: string,
): Promise<T | undefined> {
  return runGhApiGraphqlArgs<T>(root, [
    '-f',
    `query=${query}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `repo=${repo}`,
    '-F',
    `number=${number}`,
  ]);
}

function runGhApiGraphqlVars<T>(
  root: string,
  query: string,
  vars: Record<string, string>,
): Promise<T | undefined> {
  const args = ['-f', `query=${query}`];
  for (const [key, value] of Object.entries(vars)) {
    args.push('-f', `${key}=${value}`);
  }
  return runGhApiGraphqlArgs<T>(root, args);
}

function runGhApiGraphqlArgs<T>(root: string, args: string[]): Promise<T | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['api', 'graphql', ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      proc.kill();
      settle(() => resolve(undefined));
    }, GH_API_TIMEOUT_MS);
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => {
      settle(() => {
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
    });
    proc.on('error', () => settle(() => resolve(undefined)));
  });
}

/** `gh pr list` has no field for review-thread resolution or activity timing. */
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
          id
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
  id: string;
  isResolved: boolean;
  comments: { nodes: GraphqlThreadComment[] };
}

/** Best-effort: resolves `[]` on any failure rather than throwing. */
export async function fetchUnresolvedThreads(root: string, url: string): Promise<ReviewThread[]> {
  const parsed = parsePrUrl(url);
  if (!parsed) return [];
  const data = await runGhApiGraphql<{
    data?: { repository?: { pullRequest?: { reviewThreads: { nodes: GraphqlThreadNode[] } } } };
  }>(root, REVIEW_THREAD_COMMENTS_QUERY, parsed.owner, parsed.repo, parsed.number);
  const nodes = data?.data?.repository?.pullRequest?.reviewThreads.nodes ?? [];
  return nodes
    .filter((n) => !n.isResolved)
    .map((n) => ({ id: n.id, comment: n.comments.nodes[0] }))
    .filter((t): t is { id: string; comment: GraphqlThreadComment } => Boolean(t.comment))
    .map(({ id, comment: c }) => ({
      id,
      ...(c.path ? { path: c.path } : {}),
      ...(c.line != null ? { line: c.line } : {}),
      ...(c.author?.login ? { author: c.author.login } : {}),
      body: c.body,
    }));
}

const RESOLVE_THREAD_MUTATION = `
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}`;

const REPLY_THREAD_MUTATION = `
mutation($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
    comment { id }
  }
}`;

/** Best-effort: returns `false` on any failure — a failed resolve must not fail the push that triggered it. */
export async function resolveReviewThread(root: string, threadId: string): Promise<boolean> {
  const data = await runGhApiGraphqlVars<{
    data?: { resolveReviewThread?: { thread?: { isResolved: boolean } } };
  }>(root, RESOLVE_THREAD_MUTATION, { threadId });
  return Boolean(data?.data?.resolveReviewThread?.thread?.isResolved);
}

export async function replyToReviewThread(
  root: string,
  threadId: string,
  body: string,
): Promise<boolean> {
  const data = await runGhApiGraphqlVars<{
    data?: { addPullRequestReviewThreadReply?: { comment?: { id: string } } };
  }>(root, REPLY_THREAD_MUTATION, { threadId, body });
  return Boolean(data?.data?.addPullRequestReviewThreadReply?.comment?.id);
}

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
        '--limit',
        '2000',
        '--json',
        'number,url,state,isDraft,headRefName,body,reviewDecision',
      ],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      proc.kill();
      settle(() => resolve(undefined));
    }, GH_API_TIMEOUT_MS);
    let stdout = '';
    proc.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    // Drain stderr — an unread pipe can fill and hang the subprocess.
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => {
      settle(() => {
        // Non-zero means "can't resolve" (no gh, offline, unauthenticated), not "no
        // PRs" — caller must fall back rather than treat this as a confirmed empty set.
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
    });
    proc.on('error', () => settle(() => resolve(undefined)));
  });
}

/** `undefined` means the lookup couldn't resolve at all; callers fall back to stored status. */
export async function resolvePrsByEntity(
  root: string,
  ttlMs = PR_CACHE_TTL_MS,
): Promise<Map<string, PrInfo> | undefined> {
  const cached = cache.get(root);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.prs;
  const prs = await runGhPrListAll(root);
  // Only cache a successful resolution — caching `undefined` would pin the whole
  // worklist to stored status for the full TTL instead of retrying on the next read.
  if (prs !== undefined) cache.set(root, { prs, fetchedAt: Date.now() });
  return prs;
}

export function clearPrCache(): void {
  cache.clear();
}
