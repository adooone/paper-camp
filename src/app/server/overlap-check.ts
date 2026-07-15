import type { SimilarityCandidate } from '@/app/features/plans/helpers';
import { buildOverlapCheckPrompt } from '@/app/features/plans/prompts';
import type { OverlapVerdict } from '@/types/index';

const VALID_VERDICTS: OverlapVerdict['verdict'][] = ['existing', 'extend', 'new'];

/**
 * One-shot, read-only agent call — not the long-running phase/task system in agent.ts.
 * The actual process spawn lives in agent.ts's runOverlapCheck, which runs independently
 * of the shared `current` task so it's never blocked by (and never blocks) a running
 * phase/reconcile/etc; this module only builds the prompt and parses the result.
 */
export async function checkIdeaOverlap(
  text: string,
  candidates: SimilarityCandidate[],
  runPrompt: (prompt: string) => Promise<string>,
): Promise<OverlapVerdict> {
  if (!text.trim()) {
    throw new Error('Nothing to check — type a title or body first');
  }

  const prompt = buildOverlapCheckPrompt(text, candidates);
  const output = await runPrompt(prompt);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {
    // fall through with raw output
  }

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable overlap verdict');

  const data = JSON.parse(match[0]) as {
    verdict?: string;
    targetId?: string | null;
    reasoning?: string;
  };
  if (!data.verdict || !VALID_VERDICTS.includes(data.verdict as OverlapVerdict['verdict'])) {
    throw new Error('Agent returned an unrecognized verdict');
  }

  return {
    verdict: data.verdict as OverlapVerdict['verdict'],
    targetId: data.targetId ?? null,
    reasoning: data.reasoning ?? '',
  };
}
