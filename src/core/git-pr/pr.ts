import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  type ConsistencyIssue,
  type EntityEntry,
  type EntityType,
  PLAN_KINDS,
  type PhaseItem,
} from '../../types/index';
import {
  findConsistencyIssues,
  parseDecisions,
  parseEntityFile,
  parseOpenQuestions,
} from '../parse/parser';
import { entityToPlan, readEntities } from '../readers';
import { computePlanContentHash } from '../serialize/content-hash';
import { parsePrUrl, resolveEntityIdFromPrRef } from './pr-lookup';
import { COMMIT_SCOPES, resolvePrimaryScope } from './scopes';

export {
  clearPrCache,
  fetchUnresolvedThreads,
  replyToReviewThread,
  resolvePrsByEntity,
  resolveReviewThread,
} from './pr-lookup';

interface GhPrCommentRow {
  body: string;
  url: string;
}

interface GhPrViewRow {
  title: string;
  body: string;
  headRefName: string;
  labels: { name: string }[];
  isDraft: boolean;
  state: string;
  url: string;
  comments: GhPrCommentRow[];
}

/** `gh pr view <ref>` — resolves `undefined` on any non-zero exit, not just "no PR yet". */
function runGhPrView(root: string, ref: string): Promise<GhPrViewRow | undefined> {
  return new Promise((resolve) => {
    const proc = spawn(
      'gh',
      ['pr', 'view', ref, '--json', 'title,body,headRefName,labels,isDraft,state,url,comments'],
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

interface ResolvedPlanForPr {
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

export function renderPlanPhasesIntoBody(body: string, phases: PhaseItem[]): string {
  const items = phases.map((phase) => `- [${phase.done ? 'x' : ' '}] ${phase.text}`).join('\n');
  const section = `${PHASES_SECTION_START}\n### Phases\n${items}\n${PHASES_SECTION_END}`;

  if (PHASES_SECTION_RE.test(body)) return body.replace(PHASES_SECTION_RE, () => section);
  const trimmed = body.trimEnd();
  return trimmed.length > 0 ? `${trimmed}\n\n${section}` : section;
}

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

export async function syncPlanPhasesToPr(
  root: string,
  ref: string,
): Promise<'updated' | 'unchanged' | 'unresolved'> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view) return 'unresolved';
  const { view, entry } = context;

  const newBody = renderPlanPhasesIntoBody(view.body, entry.phases);
  if (newBody === view.body) return 'unchanged';

  const ok = await runGhPrEditBody(root, ref, newBody);
  return ok ? 'updated' : 'unresolved';
}

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

export async function syncPrLabelsToPr(
  root: string,
  ref: string,
): Promise<'updated' | 'unchanged' | 'unresolved'> {
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

/** Squash-merge inherits this verbatim as the release commit, so the format has to
 * be conventional-commit from the start, not just readable. */
export function computePrTitle(
  id: string,
  entry: Pick<EntityEntry, 'type' | 'tags' | 'title'>,
): string {
  const type = entry.type ?? 'feat';
  const scope = resolvePrimaryScope(entry.tags, 'repo');
  return `${type}(${scope}): ${entry.title} (${id})`;
}

const CONVENTIONAL_PR_TITLE_RE = new RegExp(`^(${PLAN_KINDS.join('|')})\\(([a-z-]+)\\): .+$`);

export function isConventionalPrTitle(title: string): boolean {
  const match = title.match(CONVENTIONAL_PR_TITLE_RE);
  return !!match && COMMIT_SCOPES.has(match[2]);
}

function runGhPrEditTitle(root: string, ref: string, title: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('gh', ['pr', 'edit', ref, '--title', title], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    proc.stderr?.on('data', () => {});
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export async function syncPrTitleToPr(
  root: string,
  ref: string,
): Promise<'updated' | 'unchanged' | 'unresolved'> {
  const context = await resolvePlanContext(root, ref);
  if (!context?.view) return 'unresolved';
  const { id, view, entry } = context;

  const desired = computePrTitle(id, entry);
  if (view.title === desired) return 'unchanged';

  const ok = await runGhPrEditTitle(root, ref, desired);
  return ok ? 'updated' : 'unresolved';
}

/** Not best-effort like the sync-* commands: a squash-merged commit inherits the
 * PR title verbatim, so an unconventional hand-typed title must fail the check
 * rather than pass silently and fall out of the changelog. When the branch/PR
 * resolves to a plan, the title must match that plan's title exactly — a
 * conventional but unrelated title (stale or hand-edited) is still invalid. */
export async function validatePrTitle(
  root: string,
  ref: string,
): Promise<'valid' | 'invalid' | 'no-pr'> {
  const view = await runGhPrView(root, ref);
  if (!view) return 'no-pr';

  const context = await resolvePlanContext(root, ref);
  if (context) {
    return view.title === computePrTitle(context.id, context.entry) ? 'valid' : 'invalid';
  }
  return isConventionalPrTitle(view.title) ? 'valid' : 'invalid';
}

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

export async function syncPrReadinessToPr(
  root: string,
  ref: string,
): Promise<'ready' | 'closed' | 'unchanged' | 'unresolved'> {
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
  stale: boolean;
}

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

/** No `gh pr comment --edit` by marker exists, so this drops to the raw REST PATCH endpoint. */
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

export async function syncConsistencyCommentToPr(
  root: string,
  ref: string,
): Promise<'created' | 'updated' | 'unchanged' | 'unresolved'> {
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
    // The `id` from `gh pr view --json comments` is a GraphQL node id, unusable with the REST PATCH endpoint.
    const commentId = existing.url.match(/issuecomment-(\d+)/)?.[1];
    if (!parsedUrl || !commentId) return 'unresolved';
    const ok = await runGhApiPatchComment(root, parsedUrl.owner, parsedUrl.repo, commentId, body);
    return ok ? 'updated' : 'unresolved';
  }

  const ok = await runGhPrCommentCreate(root, ref, body);
  return ok ? 'created' : 'unresolved';
}
