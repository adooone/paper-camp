import { buildFeedbackReplyPrompt } from '@/app/features/plans/prompts';
import type { PlanEntry } from '@/types/index';

// One-shot, read-only agent call, not the long-running phase/task system in
// agent.ts: runs independently of the task registry, so it's never blocked by
// (and never blocks) a running phase/reconcile/etc.
export async function replyToFeedback(
  plan: PlanEntry,
  runPrompt: (prompt: string, planTitle: string) => Promise<string>,
): Promise<string> {
  const prompt = buildFeedbackReplyPrompt(plan);
  const output = await runPrompt(prompt, plan.title);

  let text = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') text = parsed.result;
  } catch {}

  text = text.trim();
  if (!text) throw new Error('Agent did not return a reply');
  return text;
}
