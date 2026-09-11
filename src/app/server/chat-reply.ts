import { buildChatReplyPrompt } from '@/app/features/plans/prompts';
import type { ThreadMessage } from '@/types/index';

// Claude's `-p --output-format json` wraps the model's text in {result: "..."}; opencode's
// `--format json` doesn't — unwrap either shape, same as feedback-reply.ts's extractJsonBlock.
function unwrapResult(output: string): string {
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') return parsed.result;
  } catch {}
  return output;
}

export async function replyToChat(
  thread: ThreadMessage[],
  runPrompt: (prompt: string) => Promise<string>,
): Promise<string> {
  const output = await runPrompt(buildChatReplyPrompt(thread));
  return unwrapResult(output).trim();
}
