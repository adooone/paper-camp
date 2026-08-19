import { join, sep } from 'node:path';
import {
  type PrReviewDelivery,
  createPrReview,
  dispatchPrReview,
  scoutReviewFooter,
} from '@/core/git-pr';
import { readEntities } from '@/core/readers';
import { agentThreadMessage } from '@/core/serialize';
import type { PrReviewFinding, PrReviewResult, PrReviewVerdict } from '@/types/index';
import { campFile, entityFileInput, fileExists, writeEntityFile } from './helpers';

const VERDICTS: PrReviewVerdict[] = ['approve', 'comment', 'request-changes'];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function validatePrReviewVerdict(candidate: string): PrReviewResult | undefined {
  try {
    const parsed = JSON.parse(candidate) as {
      verdict?: string;
      assessment?: string;
      concerns?: string[];
      findings?: { path?: string; line?: number; body?: string }[];
    };
    if (!parsed.verdict || !VERDICTS.includes(parsed.verdict as PrReviewVerdict)) return undefined;
    if (!parsed.assessment) return undefined;
    const rawConcerns = parsed.concerns ?? [];
    if (!Array.isArray(rawConcerns) || rawConcerns.some((c) => typeof c !== 'string')) {
      return undefined;
    }
    const rawFindings = parsed.findings ?? [];
    if (!Array.isArray(rawFindings)) return undefined;
    const findings: PrReviewFinding[] = [];
    for (const f of rawFindings) {
      if (typeof f.path !== 'string' || !f.path) return undefined;
      if (typeof f.line !== 'number' || !Number.isInteger(f.line) || f.line < 1) return undefined;
      if (typeof f.body !== 'string' || !f.body) return undefined;
      findings.push({ path: f.path, line: f.line, body: f.body });
    }
    return {
      verdict: parsed.verdict as PrReviewVerdict,
      assessment: parsed.assessment,
      concerns: rawConcerns,
      findings,
    };
  } catch {
    return undefined;
  }
}

// Scans lines backwards for the last valid verdict JSON, since models wrap it in
// a ```json fence and an earlier quoted snippet could otherwise win instead.
export function parsePrReviewResult(taskLines: string[]): PrReviewResult | undefined {
  const lines = taskLines.flatMap((entry) => entry.split('\n'));
  for (let i = lines.length - 1; i >= 0; i--) {
    const candidate = lines[i].trim();
    if (!candidate.startsWith('{')) continue;
    const result = validatePrReviewVerdict(candidate);
    if (result) return result;
  }
  return undefined;
}

const VERDICT_LABELS: Record<PrReviewVerdict, string> = {
  approve: 'Approves',
  comment: 'Comments',
  'request-changes': 'Requests changes',
};

function findingsPhrase(n: number): string {
  return `${n} finding${n === 1 ? '' : 's'}`;
}

const MAX_DISPATCH_FINDINGS = 20;

function capFindings(findings: PrReviewFinding[]): { kept: PrReviewFinding[]; dropped: number } {
  if (findings.length <= MAX_DISPATCH_FINDINGS) return { kept: findings, dropped: 0 };
  return {
    kept: findings.slice(0, MAX_DISPATCH_FINDINGS),
    dropped: findings.length - MAX_DISPATCH_FINDINGS,
  };
}

export function renderReviewGithubBody(
  result: PrReviewResult,
  footer: { ideaId: string; sha: string; droppedFindings?: number; invalidLineFindings?: number },
): string {
  const lines = [
    `**${VERDICT_LABELS[result.verdict]}** · ${findingsPhrase(result.findings.length)}`,
    '',
    result.assessment,
  ];
  if (result.concerns.length > 0) {
    lines.push('', '**Concerns**', ...result.concerns.map((c) => `- ${c}`));
  }
  if (footer.droppedFindings) {
    lines.push(
      '',
      `_${findingsPhrase(footer.droppedFindings)} omitted to fit the review's size limit._`,
    );
  }
  if (footer.invalidLineFindings) {
    lines.push(
      '',
      `_${findingsPhrase(footer.invalidLineFindings)} omitted — GitHub rejected the line as outside the diff._`,
    );
  }
  lines.push('', `<sub>${scoutReviewFooter(footer.ideaId, footer.sha)}</sub>`);
  return lines.join('\n');
}

export function renderReviewThreadMessage(result: PrReviewResult): string {
  const label = VERDICT_LABELS[result.verdict];
  return `${label} · ${findingsPhrase(result.findings.length)} — ${result.assessment}`;
}

/** Closed by status or by living in ideas/archive/ — the same two signals
 *  `deriveStatus` treats as closed. */
function isClosedEntity(entry: { status?: string }, file: string): boolean {
  if (entry.status === 'done' || entry.status === 'dropped') return true;
  return file.includes(`${sep}archive${sep}`);
}

type ThreadWriteOutcome = 'written' | 'closed' | 'failed';

async function appendReviewThreadMessage(
  root: string,
  entityId: string,
  summary: string,
): Promise<ThreadWriteOutcome> {
  const ideasDir = campFile(root, 'ideas');
  const primaryFile = join(ideasDir, `${entityId}.md`);
  const archivedFile = join(ideasDir, 'archive', `${entityId}.md`);
  const file = (await fileExists(primaryFile)) ? primaryFile : archivedFile;
  if (!(await fileExists(file))) return 'failed';

  const { entries } = await readEntities(ideasDir);
  const entry = entries.find((e) => e.id === entityId);
  if (!entry) return 'failed';
  // A review can land long after the PR merged and the entity closed — waiting on
  // GitHub means the result arrives whenever it arrives. Writing it then reopens a
  // settled file for a verdict nothing can act on, so a closed entity is left alone.
  if (isClosedEntity(entry, file)) return 'closed';

  await writeEntityFile(
    root,
    file,
    entityFileInput(entry, {
      thread: [...(entry.thread ?? []), agentThreadMessage(summary, 'review')],
    }),
  );
  return 'written';
}

/** Whether the verdict reached at least one destination — a GitHub post or the
 * idea thread message — and, if it reached neither, why. */
export interface PostPrReviewOutcome {
  delivered: boolean;
  reason?: string;
}

function isUnprocessableEntity(body: string | undefined): boolean {
  return body !== undefined && /\bHTTP 422\b/.test(body);
}

// createPrReview posts all-or-nothing: GitHub rejects the whole review with 422
// if any single comment's line isn't part of the diff. Retrying once with no
// inline comments turns a bad line number into a dropped finding instead of a
// lost review.
async function createPrReviewDegraded(
  root: string,
  prUrl: string,
  result: PrReviewResult,
  entityId: string,
  sha: string,
): Promise<{ delivery: PrReviewDelivery; dropped: number }> {
  const attempt = (comments: PrReviewFinding[], invalidLineFindings?: number) =>
    createPrReview(root, prUrl, {
      body: renderReviewGithubBody(result, { ideaId: entityId, sha, invalidLineFindings }),
      event: 'COMMENT',
      comments,
    }).catch((err): PrReviewDelivery => ({ delivered: false, body: errorMessage(err) }));

  const first = await attempt(result.findings);
  if (first.delivered || result.findings.length === 0 || !isUnprocessableEntity(first.body)) {
    return { delivery: first, dropped: 0 };
  }
  const fallback = await attempt([], result.findings.length);
  return { delivery: fallback, dropped: result.findings.length };
}

// Posts the GitHub review (each finding becomes a resolvable thread — exactly
// what fetchUnresolvedThreads already consumes, so the Fix-review button picks
// them up unchanged) and lands the verdict as a [review] thread message on the
// idea, so it's in the corpus and travels with the entity (IDEA-170).
export async function postPrReview(
  root: string,
  entityId: string,
  prUrl: string,
  sha: string,
  result: PrReviewResult,
  onLine: (text: string) => void,
): Promise<PostPrReviewOutcome> {
  const { kept, dropped } = capFindings(result.findings);
  const dispatched = await dispatchPrReview(root, prUrl, {
    body: renderReviewGithubBody(result, { ideaId: entityId, sha, droppedFindings: dropped }),
    event: 'COMMENT',
    comments: kept,
  }).catch((err): PrReviewDelivery => ({ delivered: false, body: errorMessage(err) }));

  const [direct, logged] = await Promise.all([
    dispatched.delivered
      ? Promise.resolve({ delivery: { delivered: true } as PrReviewDelivery, dropped: 0 })
      : createPrReviewDegraded(root, prUrl, result, entityId, sha),
    appendReviewThreadMessage(root, entityId, renderReviewThreadMessage(result)).catch(
      (): ThreadWriteOutcome => 'failed',
    ),
  ]);
  const posted = direct.delivery;

  const githubPosted = dispatched.delivered || posted.delivered;
  const postPart = dispatched.delivered
    ? `dispatched to the Scout review workflow (${findingsPhrase(kept.length)}${dropped ? `, ${dropped} dropped` : ''})`
    : posted.delivered
      ? `posted directly to GitHub, dispatch unavailable (${findingsPhrase(result.findings.length - direct.dropped)}${direct.dropped ? `, ${direct.dropped} dropped — invalid line` : ''})`
      : `GitHub post failed${posted.body ? `: ${posted.body}` : ''}`;
  const logPart =
    logged === 'written'
      ? 'recorded on the idea'
      : logged === 'closed'
        ? 'idea already closed, not recorded'
        : 'could not record on the idea';
  onLine(`Review ${postPart}, ${logPart}`);

  // A skipped write on a closed idea is not a delivery failure: the verdict still
  // reached GitHub, which is the only place it can still be acted on.
  if (githubPosted || logged === 'written') return { delivered: true };
  return { delivered: false, reason: `${postPart}, ${logPart}` };
}
