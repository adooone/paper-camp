import {
  type CommitConvention,
  DEFAULT_COMMIT_CONVENTION,
  commitTitleViolation,
} from '@/core/commit-convention';

function conventionLine(convention: CommitConvention): string {
  const types = convention.types.join('|');
  const scope = convention.scopes
    ? `scope is ${convention.scopeRequired ? 'required and ' : ''}one of this fixed list: ${convention.scopes.join(', ')}`
    : convention.scopeRequired
      ? 'scope is required: the subsystem area the diff most affects'
      : 'scope is optional: the subsystem area the diff most affects';
  return `Follow this repo's commit convention: \`type(scope): Description\`, where type is one of ${types} and ${scope}. Pick the area the diff most affects. Keep the whole title under 100 characters and do not end it with a period.`;
}

function buildPrompt(
  diffText: string,
  planContext: string | undefined,
  convention: CommitConvention,
  rejected?: { title: string; violation: string },
): string {
  const retry = rejected
    ? `\nYour previous title "${rejected.title}" was rejected: ${rejected.violation}. Choose again within the convention.\n`
    : '';
  return `You are writing a single git commit message for the diff below. Do not use any tools, do not read or edit any files — base your answer only on the diff text given.

${conventionLine(convention)}${
  planContext
    ? `\nThis work belongs to plan ${planContext}. Do NOT put the plan id in the scope — instead end the message body with a \`Refs: ${planContext}\` line as its final line.`
    : ''
}
${retry}
Respond with ONLY a single JSON object, no prose, no code fences, no markdown — exactly this shape:
{"title": "type(scope): Description", "message": "${
    planContext
      ? `longer body describing what changed and why, ending with a \`Refs: ${planContext}\` line`
      : 'optional longer body describing what changed and why, or an empty string if the title alone is clear enough'
  }"}

Diff:
${diffText}`;
}

function parseSuggestion(output: string): { title: string; message: string } {
  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}

  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Agent did not return a parseable commit message');

  const data = JSON.parse(match[0]) as { title?: string; message?: string };
  if (!data.title) throw new Error('Agent response missing a title');
  return { title: data.title.trim(), message: data.message ?? '' };
}

// One-shot read-only agent call, never blocked by a running task; a title the hook
// would reject goes back once with the reason, and a second miss surfaces it.
export async function suggestCommitMessage(
  diffText: string,
  planContext: string | undefined,
  runPrompt: (prompt: string) => Promise<string>,
  convention: CommitConvention = DEFAULT_COMMIT_CONVENTION,
): Promise<{ title: string; message: string }> {
  if (!diffText.trim()) {
    throw new Error('No changes to summarize — select at least one file first');
  }

  let suggestion = parseSuggestion(await runPrompt(buildPrompt(diffText, planContext, convention)));
  let violation = commitTitleViolation(suggestion.title, convention);
  if (violation) {
    const rejected = { title: suggestion.title, violation };
    suggestion = parseSuggestion(
      await runPrompt(buildPrompt(diffText, planContext, convention, rejected)),
    );
    violation = commitTitleViolation(suggestion.title, convention);
    if (violation) {
      throw new Error(`Suggested title "${suggestion.title}" is not allowed: ${violation}`);
    }
  }

  let { message } = suggestion;
  // The prompt asks for a `Refs: <plan>` footer when a plan is active; backfill it
  // if the model dropped it, so plan traceability stays consistent.
  if (planContext && !/Refs:\s*\S/.test(message)) {
    message = message ? `${message}\n\nRefs: ${planContext}` : `Refs: ${planContext}`;
  }
  return { title: suggestion.title, message };
}
