import { buildReviewSplitPrompt } from '@/app/features/plans/prompts';
import type { LogEntry, PlanEntry, ReviewSplitItem, ReviewSplitResult } from '@/types/index';

interface RawReviewSplitItem {
  n?: number;
  kind?: string;
  phases?: { text?: string; description?: string }[];
  title?: string;
  body?: string;
}

function toReviewSplitItem(raw: RawReviewSplitItem, point: string): ReviewSplitItem | undefined {
  if (raw.kind === 'rework') {
    const phases = raw.phases ?? [];
    if (phases.length === 0 || phases.some((p) => !p.text?.trim())) return undefined;
    return {
      point,
      kind: 'rework',
      phases: phases.map((p) => ({
        text: (p.text as string).trim(),
        description: p.description?.trim() || undefined,
      })),
    };
  }
  if (raw.kind === 'idea') {
    if (!raw.title?.trim() || !raw.body?.trim()) return undefined;
    return { point, kind: 'idea', followUp: { title: raw.title.trim(), body: raw.body.trim() } };
  }
  return undefined;
}

// One-shot, read-only agent call, not the long-running phase/task system in
// agent.ts: runs independently of the task registry, so it's never blocked by
// (and never blocks) a running phase/reconcile/etc.
export async function splitReview(
  plan: PlanEntry,
  points: LogEntry[],
  runPrompt: (prompt: string) => Promise<string>,
): Promise<ReviewSplitResult> {
  if (points.length === 0) {
    throw new Error('Nothing to split — this plan has no review points yet');
  }

  const prompt = buildReviewSplitPrompt(plan, points);
  const output = await runPrompt(prompt);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable review split');

  const data = JSON.parse(match[0]) as { items?: RawReviewSplitItem[] };
  const rawItems = data.items ?? [];
  if (rawItems.length !== points.length) {
    throw new Error('Agent split did not cover every review point exactly once');
  }

  const items = new Array<ReviewSplitItem | undefined>(points.length);
  for (const raw of rawItems) {
    const n = raw.n;
    if (
      typeof n !== 'number' ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > points.length ||
      items[n - 1]
    ) {
      throw new Error('Agent split did not cover every review point exactly once');
    }
    const item = toReviewSplitItem(raw, points[n - 1].text);
    if (!item) throw new Error(`Agent split for point ${n} was malformed`);
    items[n - 1] = item;
  }

  return { items: items as ReviewSplitItem[] };
}
