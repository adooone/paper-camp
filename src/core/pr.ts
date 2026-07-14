import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConsistencyIssue, EntityEntry, EntityType, PhaseItem } from '../types/index';
import { computePlanContentHash } from './content-hash';
import {
  findConsistencyIssues,
  parseDecisions,
  parseEntityFile,
  parseOpenQuestions,
} from './parser';
import { parsePrUrl, resolveEntityIdFromPrRef } from './pr-lookup';
import { entityToPlan, readEntities } from './readers';
import { COMMIT_SCOPES } from './scopes';

export { clearPrCache, fetchUnresolvedThreads, resolvePrsByEntity } from './pr-lookup';

interface GhPrCommentRow {
  body: string;
  url: string;
}

interface GhPrViewRow {
  body: string;
  headRefName: string;
  labels: { name: string }[];
  isDraft: boolean;
  state: string;
  url: string;
  comments: GhPrCommentRow[];
}

/**
 * `gh pr view <ref>` — `ref` accepts a PR number or a branch name interchangeably,
 * so callers don't need to know which they were given. Resolves `undefined` when
 * no PR exists yet for `ref` (e.g. the first push, before `draft-pr.yml` runs),
 * same "can't resolve, not a confirmed empty result" contract as `runGhPrListAll`.
 */
function runGhPrView(root: string, ref: string): Promise<GhPrViewRow | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      ['pr', 'view', ref, '--json', 'body,headRefName,labels,isDraft,state,url,comments'],
      {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
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
        resolve(JSON.parse(stdout) as GhPrViewRow);
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

async function findEntityFile(root: string, id: string): Promise<string | null> {
  for (const dir of ['ideas', join('ideas', 'archive')]) {
    const file = join(root, 'papercamp', dir, `${id}.md`);
    try {
      await stat(file);
      return file;
    } catch {}
  }
  return null;
}

/** The fields later Scout workflows need to mirror a plan onto its PR. */
export interface ResolvedPlanForPr {
  id: string;
  kind?: EntityType;
  tags: string[];
  phases: PhaseItem[];
}

interface ResolvedPlanContext {
  id: string;
  view: GhPrViewRow | undefined;
  entry: EntityEntry;
}

/**
 * Shared first half of every plan↔PR lookup: `gh pr view` the ref, resolve the
 * plan id (body `**Plan:**` line, falling back to the branch), and parse its
 * entity file. Factored out so `resolvePlanForPrRef` (read-only) and
 * `syncPlanPhasesToPr` (which also needs `view.body` to rewrite) can't drift.
 */
async function resolvePlanContext(
  root: string,
  ref: string,
): Promise<ResolvedPlanContext | undefined> {
  const view = await runGhPrView(root, ref);
  const id = resolveEntityIdFromPrRef(view?.body, view?.headRefName ?? ref);
  if (!id) return undefined;

  const file = await findEntityFile(root, id);
  if (!file) return undefined;

  const { entries } = parseEntityFile(await readFile(file, 'utf-8'));
  const entry = entries[0];
  if (!entry) return undefined;

  return { id, view, entry };
}

/**
 * Resolves the plan a PR (given by number or branch) mirrors, and parses
 * `papercamp/ideas/<ID>.md` for the fields the mirroring workflows need. `ref`
 * is passed straight to `gh pr view`, so both a PR number and a branch name
 * work; when no PR exists yet for a branch, falls back to reading the plan id
 * out of the branch name itself (same convention `draft-pr.yml` uses to name
 * the PR in the first place). Returns `undefined` when the id can't be
 * resolved at all, or when it doesn't match a file under `papercamp/ideas/`.
 */
export async function resolvePlanForPrRef(
  root: string,
  ref: string,
): Promise<ResolvedPlanForPr | undefined> {
  const context = await resolvePlanContext(root, ref);
  if (!context) return undefined;
  const { id, entry } = context;
  return { id, kind: entry.type, tags: entry.tags, phases: entry.phases };
}

const PHASES_SECTION_START = '<!-- papercamp:phases:start -->';
const PHASES_SECTION_END = '<!-- papercamp:phases:end -->';
const PHASES_SECTION_RE = new RegExp(`${PHASES_SECTION_START}[\\s\\S]*?${PHASES_SECTION_END}`);

/**
 * Renders a plan's `### Phases` as a GitHub task-list checklist and
 * inserts/replaces it in a PR body between marker comments, leaving
 * everything else — notably the `**Plan:**` line `draft-pr.yml` stamps — untouched.
 * Idempotent: the same `phases` always renders the same section text, so a
 * caller can compare the result to the current body and skip the `gh pr edit`
 * call when nothing changed.
 */
export function renderPlanPhasesIntoBody(body: string, phases: PhaseItem[]): string {
  const items = phases.map((phase) => `- [${phase.done ? 'x' : ' '}] ${phase.text}`).join('\n');
  const section = `${PHASES_SECTION_START}\n### Phases\n${items}\n${PHASES_SECTION_END}`;

  if (PHASES_SECTION_RE.test(body)) return body.replace(PHASES_SECTION_RE, () => section);
  const trimmed = body.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n\n${section}` : section;
}

/**
 * `gh pr edit <ref> --body-file -` — rewrites a PR's body from stdin (avoids
 * argv length/escaping limits a `--body` flag would hit on a large body).
 */
function runGhPrEditBody(root: string, ref: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'edit', ref, '--body-file', '-'], {
      cwd: root,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
    proc.stdin?.end(body);
  });
}

export type SyncPlanPhasesResult = 'updated' | 'unchanged' | 'unresolved';

/**
 * On push to a plan branch: rewrites the PR body's phases checklist to match
 * `### Phases` in the plan file, preserving the `**Plan:**` line and
 * everything else. Only calls `gh pr edit` when the rendered body actually
 * differs from the PR's current body, so rerunning on an unchanged plan is a
 * no-op — the idempotency `renderPlanPhasesIntoBody` makes possible.
 */
export async function syncPlanPhasesToPr(root: string, ref: string): Promise<SyncPlanPhasesResult> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view) return 'unresolved';
  const { view, entry } = context;

  const newBody = renderPlanPhasesIntoBody(view.body, entry.phases);
  if (newBody === view.body) return 'unchanged';

  const ok = await runGhPrEditBody(root, ref, newBody);
  return ok ? 'updated' : 'unresolved';
}

/**
 * The labels a PR should carry for a plan: its `kind` (feat/fix/…, the
 * type-enum values) plus whichever `tags` are also recognized commit scopes
 * (`COMMIT_SCOPES` — the same area vocabulary `.commitlintrc.json`'s
 * `scope-enum` uses), so free-form tags that aren't area names don't leak
 * into GitHub labels. Order-stable and de-duped.
 */
export function derivePrLabels(plan: Pick<ResolvedPlanForPr, 'kind' | 'tags'>): string[] {
  const labels = new Set<string>();
  if (plan.kind) labels.add(plan.kind);
  for (const tag of plan.tags) {
    if (COMMIT_SCOPES.has(tag)) labels.add(tag);
  }
  return [...labels];
}

interface GhLabelRow {
  name: string;
}

/** `gh label list` — the repo's existing labels, so creation only happens for ones missing. */
function runGhLabelList(root: string): Promise<Set<string> | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['label', 'list', '--limit', '200', '--json', 'name'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
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
        const rows = JSON.parse(stdout) as GhLabelRow[];
        resolve(new Set(rows.map((r) => r.name)));
      } catch {
        resolve(undefined);
      }
    });
    proc.on('error', () => resolve(undefined));
  });
}

/**
 * `gh label create <name>` — no `--force`, so a label a human already created
 * (and possibly recolored/described) is never touched; this only fires for
 * names `runGhLabelList` confirmed are missing from the repo.
 */
function runGhLabelCreate(root: string, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['label', 'create', name, '--color', 'ededed'], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/** `gh pr edit <ref> --add-label <a,b,c>` — additive only, never removes an existing label. */
function runGhPrAddLabels(root: string, ref: string, labels: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'edit', ref, '--add-label', labels.join(',')], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export type SyncPrLabelsResult = 'updated' | 'unchanged' | 'unresolved';

/**
 * On push to a plan branch: applies the labels `derivePrLabels` derives from
 * the plan's `kind`/`tags`, creating any that don't exist in the repo yet.
 * Additive only — a label already on the PR (human-added or from a previous
 * run) is left alone, and a plan label no longer implied by the file is not
 * removed, so a human's own labeling is never clobbered. Only calls `gh` to
 * add labels that are actually missing from the PR, so rerunning on an
 * unchanged plan is a no-op.
 */
export async function syncPrLabelsToPr(root: string, ref: string): Promise<SyncPrLabelsResult> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view) return 'unresolved';
  const { view, entry } = context;

  const desired = derivePrLabels({ kind: entry.type, tags: entry.tags });
  const current = new Set((view.labels ?? []).map((l) => l.name));
  const missing = desired.filter((label) => !current.has(label));
  if (missing.length === 0) return 'unchanged';

  const repoLabels = await runGhLabelList(root);
  if (repoLabels) {
    const toCreate = missing.filter((label) => !repoLabels.has(label));
    for (const label of toCreate) {
      await runGhLabelCreate(root, label);
    }
  }

  const ok = await runGhPrAddLabels(root, ref, missing);
  return ok ? 'updated' : 'unresolved';
}

/** `gh pr ready <ref>` — flips a draft PR to ready for review. */
function runGhPrReady(root: string, ref: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'ready', ref], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

/** `gh pr close <ref>` — closes a PR without merging, for a plan marked `dropped`. */
function runGhPrClose(root: string, ref: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'close', ref], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export type SyncPrReadinessResult = 'ready' | 'closed' | 'unchanged' | 'unresolved';

/**
 * On push to a plan branch: one-way plan → PR readiness, never plan status.
 * A stored `dropped` override closes an open PR (abandonment leaves no other
 * trace to derive from, per `core/status.ts`). Otherwise, once every phase in
 * the plan is checked, a draft PR flips to ready for review — the phases list
 * is the derived `review` signal per `core/status.ts`. Anything already in the
 * target state (a non-draft PR with all phases done, an already-closed
 * dropped PR) is a no-op, so rerunning on an unchanged plan doesn't call `gh`
 * again. Marking a plan `done` on merge is deliberately not done here — that's
 * `core/status.ts`'s derivation from the merged PR, not a write this function
 * makes.
 */
export async function syncPrReadinessToPr(
  root: string,
  ref: string,
): Promise<SyncPrReadinessResult> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view) return 'unresolved';
  const { view, entry } = context;

  if (entry.status === 'dropped') {
    if (view.state !== 'OPEN') return 'unchanged';
    const ok = await runGhPrClose(root, ref);
    return ok ? 'closed' : 'unresolved';
  }

  const allPhasesDone = entry.phases.length > 0 && entry.phases.every((phase) => phase.done);
  if (!allPhasesDone || !view.isDraft) return 'unchanged';

  const ok = await runGhPrReady(root, ref);
  return ok ? 'ready' : 'unresolved';
}

const CONSISTENCY_SECTION_START = '<!-- papercamp:consistency:start -->';
const CONSISTENCY_SECTION_END = '<!-- papercamp:consistency:end -->';

interface AuditSummary {
  audited: string;
  /** Whether the plan's content has changed since the stored `audited-hash`. */
  stale: boolean;
}

/**
 * Renders `findConsistencyIssues`' repo-wide results, plus the plan's own
 * convergence-audit staleness where one has been recorded, as a sticky PR
 * comment body wrapped in marker comments (same `find/replace-by-marker`
 * shape as `renderPlanPhasesIntoBody`). Deterministic for the same inputs, so
 * a caller can compare against the existing sticky comment and skip the `gh`
 * call when nothing changed.
 */
export function renderConsistencyComment(issues: ConsistencyIssue[], audit?: AuditSummary): string {
  const lines = ['### Paper Camp checks', ''];
  if (issues.length === 0) {
    lines.push('No consistency issues found.');
  } else {
    for (const issue of issues) {
      lines.push(`- **${issue.kind}** (${issue.section}): ${issue.message}`);
    }
  }
  if (audit) {
    lines.push('');
    lines.push(
      audit.stale
        ? `Convergence audit: last run \`${audit.audited}\`, plan has changed since — due for a re-audit.`
        : `Convergence audit: last run \`${audit.audited}\`, still current.`,
    );
  }
  return `${CONSISTENCY_SECTION_START}\n${lines.join('\n')}\n${CONSISTENCY_SECTION_END}`;
}

/** `gh pr comment <ref> --body-file -` — posts a new top-level PR comment from stdin. */
function runGhPrCommentCreate(root: string, ref: string, body: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'comment', ref, '--body-file', '-'], {
      cwd: root,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
    proc.stdin?.end(body);
  });
}

/**
 * `gh api repos/<owner>/<repo>/issues/comments/<id> -X PATCH -F body=@-` — edits an
 * existing comment by its REST id, reading the new body from stdin. There's no
 * `gh pr comment --edit` by marker, so this is the one place `core/pr.ts` drops to
 * the raw REST API rather than a `gh pr`/`gh label` subcommand.
 */
function runGhApiPatchComment(
  root: string,
  owner: string,
  repo: string,
  commentId: string,
  body: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      [
        'api',
        `repos/${owner}/${repo}/issues/comments/${commentId}`,
        '-X',
        'PATCH',
        '-F',
        'body=@-',
      ],
      { cwd: root, stdio: ['pipe', 'ignore', 'pipe'] },
    );
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
    proc.stdin?.end(body);
  });
}

/** Extracts the numeric REST comment id from a comment's `html_url` (`...#issuecomment-123`) — the
 * `id` field in `gh pr view --json comments` is a GraphQL node id, not usable with the REST PATCH endpoint. */
function parseCommentRestId(url: string): string | null {
  const match = url.match(/issuecomment-(\d+)/);
  return match ? match[1] : null;
}

export type SyncConsistencyCommentResult = 'created' | 'updated' | 'unchanged' | 'unresolved';

/**
 * On push to a plan branch: upserts a single sticky Scout comment on the PR with
 * `findConsistencyIssues`' repo-wide results (dangling decision/question links, an
 * open question blocking an already-active plan) and, when the plan carries a
 * recorded convergence audit, whether it's gone stale since — so Paper Camp's own
 * structured checks sit next to CI and CodeRabbit where review actually happens.
 * Reads decisions/open-questions/plans straight off the checked-out branch (same
 * corpus `/api/consistency` reads), not scoped to just this plan, since most issue
 * kinds aren't plan-specific. Finds the existing sticky comment by its marker and
 * PATCHes it via the REST id parsed from its URL rather than `gh pr comment
 * --edit-last`, which isn't safe once Scout has posted any other unrelated comment.
 * Only calls `gh` when the rendered body actually changed, so a rerun on an
 * unchanged repo state is a no-op.
 */
export async function syncConsistencyCommentToPr(
  root: string,
  ref: string,
): Promise<SyncConsistencyCommentResult> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view?.url) return 'unresolved';
  const { view, entry } = context;

  const [decisionsRaw, openQuestionsRaw, { entries: entityEntries }] = await Promise.all([
    readFile(join(root, 'papercamp', 'decisions.md'), 'utf-8').catch(() => ''),
    readFile(join(root, 'papercamp', 'open-questions.md'), 'utf-8').catch(() => ''),
    readEntities(join(root, 'papercamp', 'ideas')),
  ]);
  const plans = entityEntries.filter((e) => e.kind !== 'note').map((e) => entityToPlan(e));
  const issues = findConsistencyIssues(
    parseDecisions(decisionsRaw).entries,
    parseOpenQuestions(openQuestionsRaw).entries,
    plans,
  );

  const audit: AuditSummary | undefined =
    entry.audited && entry.auditedHash
      ? {
          audited: entry.audited,
          stale: computePlanContentHash(entry) !== entry.auditedHash,
        }
      : undefined;

  const body = renderConsistencyComment(issues, audit);

  const existing = (view.comments ?? []).find((c) => c.body.includes(CONSISTENCY_SECTION_START));
  if (existing) {
    if (existing.body === body) return 'unchanged';
    const parsedUrl = parsePrUrl(view.url);
    const commentId = parseCommentRestId(existing.url);
    if (!parsedUrl || !commentId) return 'unresolved';
    const ok = await runGhApiPatchComment(root, parsedUrl.owner, parsedUrl.repo, commentId, body);
    return ok ? 'updated' : 'unresolved';
  }

  const ok = await runGhPrCommentCreate(root, ref, body);
  return ok ? 'created' : 'unresolved';
}
