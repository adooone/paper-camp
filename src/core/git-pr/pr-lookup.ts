import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PrInfo, ReviewDecision, ReviewThread } from '../../types/index';

interface PrMapCacheEntry {
  /** `undefined` means `gh` couldn't resolve, distinct from a resolved-but-empty `Map`. */
  prs: Map<string, PrInfo> | undefined;
  fetchedAt: number;
}

const cache = new Map<string, PrMapCacheEntry>();

const PR_CACHE_TTL_MS = 5 * 60 * 1000;

const prMapPath = (root: string) => join(root, 'papercamp', 'pr-map.json');

interface PersistedPrMap {
  fetchedAt: number;
  prs: Record<string, PrInfo>;
}

/** Best-effort: a write failure must not fail the fetch that triggered it — worst
 * case the next restart loses this snapshot and starts from the one before it. */
async function persistPrMap(
  root: string,
  prs: Map<string, PrInfo>,
  fetchedAt: number,
): Promise<void> {
  const path = prMapPath(root);
  try {
    const payload: PersistedPrMap = { fetchedAt, prs: Object.fromEntries(prs) };
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
  } catch (err) {
    console.error(`papercamp: could not persist PR map for ${root}:`, err);
  }
}

/** A merged PR never un-merges, so a disk-loaded map is safe to serve as-is:
 * stale, never wrong. Resolves `undefined` on any missing/corrupt file. */
async function loadPersistedPrMap(root: string): Promise<PrMapCacheEntry | undefined> {
  try {
    const raw = await readFile(prMapPath(root), 'utf-8');
    const parsed = JSON.parse(raw) as PersistedPrMap;
    return { prs: new Map(Object.entries(parsed.prs)), fetchedAt: parsed.fetchedAt };
  } catch {
    return undefined;
  }
}

interface GhPrRow {
  number: number;
  url: string;
  state: string;
  isDraft: boolean;
  headRefName: string;
  headRefOid: string;
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
  return {
    number: row.number,
    url: row.url,
    state,
    ...(reviewDecision && { reviewDecision }),
    ...(row.headRefOid && { headSha: row.headRefOid }),
    ...(row.headRefName && { headBranch: row.headRefName }),
  };
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

interface ReviewSignal {
  unresolvedThreadCount: number;
  hasNewCommentsSincePush: boolean;
  reviewBodies: string[];
}

const REVIEW_THREADS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) { nodes { isResolved } }
      commits(last: 1) { nodes { commit { committedDate } } }
      comments(last: 1) { nodes { createdAt } }
      reviews(last: 20) { nodes { createdAt body } }
    }
  }
}`;

interface GraphqlPullRequest {
  reviewThreads: { nodes: { isResolved: boolean }[] };
  commits: { nodes: { commit: { committedDate: string } }[] };
  comments: { nodes: { createdAt: string }[] };
  reviews: { nodes: { createdAt: string; body: string }[] };
}

/** Rendered into the GitHub review body's footer by `renderReviewGithubBody` — the
 * one marker that ties a posted review back to the SHA the poll is waiting to
 * observe, regardless of whether it arrived via the Scout dispatch or the
 * direct-post fallback. */
export function scoutReviewFooter(entityId: string, sha: string): string {
  return `Paper Scout · ${entityId} · ${sha.slice(0, 7)}`;
}

export function parsePrUrl(url: string): { owner: string; repo: string; number: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  const [, owner, repo, number] = match;
  return { owner, repo, number };
}

const GH_API_TIMEOUT_MS = 15_000;

/** Spawns `gh <args>`, collects stdout, and parses it as JSON. Resolves
 * `undefined` on any spawn/timeout/non-zero-exit/parse failure — never throws. */
function spawnJson<T>(root: string, args: string[]): Promise<T | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('gh', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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
  return spawnJson<T>(root, ['api', 'graphql', ...args]);
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
  const latestActivity = [pr.comments.nodes[0]?.createdAt, pr.reviews.nodes.at(-1)?.createdAt]
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const hasNewCommentsSincePush = Boolean(pushedAt && latestActivity && latestActivity > pushedAt);
  const reviewBodies = pr.reviews.nodes.map((n) => n.body);
  return { unresolvedThreadCount, hasNewCommentsSincePush, reviewBodies };
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

export interface PrReviewComment {
  path: string;
  line: number;
  body: string;
}

export interface PrReviewInput {
  body: string;
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES';
  comments: PrReviewComment[];
}

/** `delivered` is false on any failure; `body` carries the GitHub response body
 * for that failure (e.g. a 422 naming the offending comment), unset on success. */
export interface PrReviewDelivery {
  delivered: boolean;
  body?: string;
}

/** `gh api` has no subcommand for review creation, so this drops to the raw REST
 * POST — the one GitHub write op paper-camp lacked; read, reply and resolve already existed. */
function runGhApiPostJson(root: string, path: string, payload: unknown): Promise<PrReviewDelivery> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['api', path, '-X', 'POST', '--input', '-'], {
      cwd: root,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    proc.stderr?.on('data', (chunk) => {
      stderr += chunk;
    });
    proc.on('close', (code) =>
      resolve(code === 0 ? { delivered: true } : { delivered: false, body: stderr.trim() }),
    );
    proc.on('error', (err) => resolve({ delivered: false, body: err.message }));
    proc.stdin?.on('error', () => {});
    proc.stdin?.end(JSON.stringify(payload));
  });
}

/** `delivered` is false on any failure, including a rejected `gh` post — a
 * failed review post must not crash the poller that triggered it. */
export async function createPrReview(
  root: string,
  url: string,
  review: PrReviewInput,
): Promise<PrReviewDelivery> {
  const parsed = parsePrUrl(url);
  if (!parsed) return { delivered: false };
  return runGhApiPostJson(
    root,
    `repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}/reviews`,
    review,
  );
}

/** Best-effort, like `createPrReview`: not delivered on any failure — including no
 * `SCOUT_APP_ID`/`SCOUT_PRIVATE_KEY` wired up, offline, or a fork with no
 * Actions access to this repo. Callers fall back to `createPrReview`. */
export async function dispatchPrReview(
  root: string,
  url: string,
  review: PrReviewInput,
): Promise<PrReviewDelivery> {
  const parsed = parsePrUrl(url);
  if (!parsed) return { delivered: false };
  return runGhApiPostJson(root, `repos/${parsed.owner}/${parsed.repo}/dispatches`, {
    event_type: 'paper-camp-review',
    client_payload: { review: { number: Number(parsed.number), ...review } },
  });
}

async function enrichWithReviewSignal(root: string, byId: Map<string, PrInfo>): Promise<void> {
  const active = [...byId.entries()].filter(
    ([, info]) => info.state === 'open' || info.state === 'draft',
  );
  const signals = await Promise.all(active.map(([, info]) => fetchReviewSignal(root, info.url)));
  active.forEach(([id, info], i) => {
    const signal = signals[i];
    if (!signal) return;
    const { reviewBodies, ...rest } = signal;
    const scoutReviewObserved =
      Boolean(info.headSha) &&
      reviewBodies.some((body) => body.includes(scoutReviewFooter(id, info.headSha as string)));
    byId.set(id, { ...info, ...rest, ...(scoutReviewObserved && { scoutReviewObserved }) });
  });
}

// Non-zero exit (or a spawn/parse failure) means "can't resolve" (no gh, offline,
// unauthenticated), not "no PRs" — caller must fall back rather than treat this as a
// confirmed empty set, so `spawnJson`'s `undefined` propagates as-is.
async function runGhPrListAll(root: string): Promise<Map<string, PrInfo> | undefined> {
  const rows = await spawnJson<GhPrRow[]>(root, [
    'pr',
    'list',
    '--state',
    'all',
    '--limit',
    '2000',
    '--json',
    'number,url,state,isDraft,headRefName,headRefOid,body,reviewDecision',
  ]);
  if (!rows) return undefined;

  const byId = new Map<string, PrInfo>();
  for (const row of rows) {
    const id = resolveEntityIdFromPrRef(row.body, row.headRefName);
    if (!id) continue;
    const info = toPrInfo(row);
    const existing = byId.get(id);
    if (!existing || STATE_RANK[info.state] > STATE_RANK[existing.state]) {
      byId.set(id, info);
    }
  }
  await enrichWithReviewSignal(root, byId);
  return byId;
}

/** `undefined` means the lookup couldn't resolve at all and nothing persisted
 * exists to fall back on either; callers fall back to stored status. */
export async function resolvePrsByEntity(
  root: string,
  ttlMs = PR_CACHE_TTL_MS,
): Promise<Map<string, PrInfo> | undefined> {
  let cached = cache.get(root);
  if (!cached) {
    // First read since process start for this root — load whatever was last
    // written to disk so a restart never resets to the phases-only guess.
    const loaded = await loadPersistedPrMap(root);
    if (loaded) {
      cache.set(root, loaded);
      cached = loaded;
    }
  }
  if (cached && Date.now() - cached.fetchedAt < ttlMs) return cached.prs;
  // An infinite TTL means "never fetch live" (file-watcher-driven callers) — serve
  // whatever's cached/persisted, even stale, rather than shelling out to `gh`.
  if (!Number.isFinite(ttlMs)) return cached?.prs;
  const prs = await runGhPrListAll(root);
  // Only cache/persist a successful resolution — caching `undefined` would pin the
  // whole worklist to stored status for the full TTL instead of retrying next read.
  if (prs !== undefined) {
    const fetchedAt = Date.now();
    cache.set(root, { prs, fetchedAt });
    await persistPrMap(root, prs, fetchedAt);
    return prs;
  }
  // Live fetch failed (offline, rate-limited): fall back to whatever's cached,
  // even if stale — a stale map is behind, never wrong.
  return cached?.prs;
}

/** Reads the timestamp of the last successful GitHub fetch without triggering one
 * — falls back to the on-disk map if nothing's cached in memory yet. */
export async function getPrMapFetchedAt(root: string): Promise<number | null> {
  let cached = cache.get(root);
  if (!cached) {
    const loaded = await loadPersistedPrMap(root);
    if (loaded) {
      cache.set(root, loaded);
      cached = loaded;
    }
  }
  return cached?.fetchedAt ?? null;
}

export function clearPrCache(): void {
  cache.clear();
}
