import { join } from 'node:path';
import { createPrReview } from '@/core/git-pr';
import { readEntities } from '@/core/readers';
import { agentThreadMessage } from '@/core/serialize';
import type { PrReviewFinding, PrReviewResult, PrReviewVerdict } from '@/types/index';
import { campFile, entityFileInput, fileExists, writeEntityFile } from './helpers';

const VERDICTS: PrReviewVerdict[] = ['approve', 'comment', 'request-changes'];

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

async function appendReviewThreadMessage(root: string, entityId: string, summary: string) {
  const ideasDir = campFile(root, 'ideas');
  const primaryFile = join(ideasDir, `${entityId}.md`);
  const archivedFile = join(ideasDir, 'archive', `${entityId}.md`);
  const file = (await fileExists(primaryFile)) ? primaryFile : archivedFile;
  if (!(await fileExists(file))) return false;

  const { entries } = await readEntities(ideasDir);
  const entry = entries.find((e) => e.id === entityId);
  if (!entry) return false;

  await writeEntityFile(
    file,
    entityFileInput(entry, {
      thread: [...(entry.thread ?? []), agentThreadMessage(summary, 'review')],
    }),
  );
  return true;
}

// Posts the GitHub review (each finding becomes a resolvable thread — exactly
// what fetchUnresolvedThreads already consumes, so the Fix-review button picks
// them up unchanged) and lands the verdict as a [review] thread message on the
// idea, so it's in the corpus and travels with the entity (IDEA-170).
export function postPrReview(
  root: string,
  entityId: string,
  prUrl: string,
  result: PrReviewResult,
  onLine: (text: string) => void,
): void {
  void (async () => {
    const [posted, logged] = await Promise.all([
      createPrReview(root, prUrl, {
        body: result.assessment,
        event: 'COMMENT',
        comments: result.findings,
      }).catch(() => false),
      appendReviewThreadMessage(root, entityId, result.assessment).catch(() => false),
    ]);
    const n = result.findings.length;
    const findingsText = `${n} finding${n === 1 ? '' : 's'}`;
    const postPart = posted ? `posted to GitHub (${findingsText})` : 'GitHub post failed';
    const logPart = logged ? 'recorded on the idea' : 'could not record on the idea';
    onLine(`Review ${postPart}, ${logPart}`);
  })();
}
