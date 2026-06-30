function buildPrompt(diffText: string, planContext?: string): string {
  return `You are writing a single git commit message for the diff below. Do not use any tools, do not read or edit any files — base your answer only on the diff text given.

Follow this repo's commit convention: \`type(scope): Description\`, where type is one of feat|fix|chore|docs|refactor and scope is a short identifier (often a plan number). Keep the whole title under 100 characters and do not end it with a period.${
    planContext
      ? `\nThis work belongs to plan ${planContext} — use it as the scope unless the diff clearly suggests otherwise.`
      : ''
  }

Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"title": "type(scope): Description", "message": "optional longer body describing what changed and why, or an empty string if the title alone is clear enough"}

Diff:
${diffText}`;
}

/**
 * One-shot, read-only agent call — not the long-running phase/task system in agent.ts.
 * The actual process spawn lives in agent.ts's runCommitSuggest, which tracks it on the
 * shared `current` task so the UI's Agent card shows it running; this module only builds
 * the prompt and parses the result.
 */
export async function suggestCommitMessage(
  diffText: string,
  planContext: string | undefined,
  runPrompt: (prompt: string) => Promise<string>,
): Promise<{ title: string; message: string }> {
  if (!diffText.trim()) {
    throw new Error('No changes to summarize — select at least one file first');
  }

  const prompt = buildPrompt(diffText, planContext);
  const output = await runPrompt(prompt);

  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {
    // fall through with raw output
  }

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable commit message');

  const data = JSON.parse(match[0]) as { title?: string; message?: string };
  if (!data.title) throw new Error('Agent response missing a title');
  return { title: data.title, message: data.message ?? '' };
}
