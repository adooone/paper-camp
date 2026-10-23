import { buildChatMovePrompt } from '@/app/features/plans/prompts';
import type { AgentTaskState, EntityEntry, TaskLogEntry, ThreadMessage } from '@/types/index';

// Claude's `-p --output-format json` wraps the text in {result: "..."}; opencode's doesn't.
// Unwrap either shape, then pull the trailing JSON object — same as feedback-reply.ts.
function extractJsonBlock(output: string): string | null {
  let resultText = output;
  try {
    const parsed = JSON.parse(output) as { result?: string };
    if (typeof parsed.result === 'string') resultText = parsed.result;
  } catch {}
  return resultText.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

type ChatMove =
  | { move: 'add_idea'; title: string; content?: string }
  | { move: 'entity'; entityId: string }
  | { move: 'answer'; reply: string };

type ChatStageEvent =
  | { stage: 'deciding' }
  | { stage: 'filing' }
  | { stage: 'posting'; entityId: string }
  | { stage: 'answering' };

export interface ChatMoveContext {
  entities: EntityEntry[];
  taskLog: TaskLogEntry[];
  agentStatus: AgentTaskState[];
}

async function decideChatMove(
  thread: ThreadMessage[],
  context: ChatMoveContext,
  runPrompt: (prompt: string) => Promise<string>,
  onStage?: (event: ChatStageEvent) => void,
): Promise<ChatMove> {
  const prompt = buildChatMovePrompt(
    thread,
    context.entities,
    context.taskLog,
    context.agentStatus,
  );
  onStage?.({ stage: 'deciding' });
  const output = await runPrompt(prompt);

  const jsonBlock = extractJsonBlock(output);
  if (!jsonBlock) throw new Error('Agent did not return a reply');

  const data = JSON.parse(jsonBlock) as {
    move?: string;
    title?: string;
    content?: string;
    entityId?: string;
    reply?: string;
  };

  if (data.move === 'add_idea' && data.title?.trim()) {
    return {
      move: 'add_idea',
      title: data.title.trim(),
      content: data.content?.trim() || undefined,
    };
  }
  if (data.move === 'entity' && data.entityId?.trim()) {
    return { move: 'entity', entityId: data.entityId.trim() };
  }

  const reply = data.reply?.trim();
  if (!reply) throw new Error('Agent did not return a reply');
  return { move: 'answer', reply };
}

function lastUserText(thread: ThreadMessage[]): string {
  return thread[thread.length - 1]?.text ?? '';
}

export interface ChatReplyDeps {
  runPrompt: (prompt: string) => Promise<string>;
  createIdea: (title: string, content: string | undefined) => Promise<string>;
  applyToEntity: (
    entityId: string,
    text: string,
  ) => Promise<{ replyText?: string; error?: string } | null>;
  onStage?: (event: ChatStageEvent) => void;
}

/** Executes whichever of the three moves (IDEA-251) the classification prompt picked,
 * deterministically — the model only ever drafts what a move needs, never performs it. */
export async function replyToChat(
  thread: ThreadMessage[],
  context: ChatMoveContext,
  deps: ChatReplyDeps,
): Promise<string> {
  const move = await decideChatMove(thread, context, deps.runPrompt, deps.onStage);

  if (move.move === 'add_idea') {
    deps.onStage?.({ stage: 'filing' });
    const id = await deps.createIdea(move.title, move.content);
    return `Filed [[${id}]] — ${move.title}.`;
  }

  if (move.move === 'entity') {
    deps.onStage?.({ stage: 'posting', entityId: move.entityId });
    const result = await deps.applyToEntity(move.entityId, lastUserText(thread));
    if (!result) return `Couldn't find ${move.entityId} to post that to.`;
    if (result.error) {
      return `Posted to [[${move.entityId}]], but the reply failed: ${result.error}`;
    }
    return `Posted to [[${move.entityId}]]: ${result.replyText}`;
  }

  deps.onStage?.({ stage: 'answering' });
  return move.reply;
}
