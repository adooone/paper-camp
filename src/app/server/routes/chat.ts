import { campFile, createIdea } from '@/core/corpus';
import { resolveClosedIdeaQuestions } from '@/core/parked-questions';
import { readTaskLog } from '@/core/parse';
import { readEntities } from '@/core/readers';
import { agentThreadMessage, nowMinuteString } from '@/core/serialize';
import type { ThreadMessage } from '@/types/index';
import { replyToChat } from '../chat-reply';
import { appendToChatFile, clearChatFile, readChatFile, readMaybe } from '../helpers';
import { readBody, sendJson } from '../http';
import { applyFeedbackMessage } from './agent';
import type { Route, RouteContext } from './types';

type ChatReplyContext = Pick<RouteContext, 'root' | 'agent' | 'git' | 'checks' | 'activity'>;

async function appendUserMessage(root: string, text: string): Promise<void> {
  await appendToChatFile(root, { kind: 'chat', date: nowMinuteString(), text });
}

async function runChatReply(
  { root, agent, git, checks, activity }: ChatReplyContext,
  thread: ThreadMessage[],
): Promise<{ error?: string }> {
  const publishStage = (event: { stage: string } & Record<string, unknown>) =>
    activity.publish({ type: 'chat', ...event });

  let error: string | undefined;
  try {
    const [{ entries }, taskLogRaw] = await Promise.all([
      readEntities(campFile(root, 'ideas')),
      readMaybe(campFile(root, 'tasks.log')),
    ]);
    const taskLog = readTaskLog(taskLogRaw);
    publishStage({ stage: 'reading', ideas: entries.length });
    const replyText = await replyToChat(
      thread,
      { entities: entries, taskLog, agentStatus: agent.getStatus() },
      {
        runPrompt: (prompt) => agent.runReadOnlyPrompt('chat', prompt, 'Project chat'),
        createIdea: (title, content) => createIdea(root, { title, content }),
        applyToEntity: async (entityId, feedbackText) => {
          const result = await applyFeedbackMessage(
            { root, git, checks, agent },
            entityId,
            feedbackText,
          );
          return result ? { replyText: result.replyText, error: result.error } : null;
        },
        onStage: publishStage,
      },
    );
    await appendToChatFile(
      root,
      agentThreadMessage(replyText, 'chat', undefined, undefined, nowMinuteString()),
    );
    publishStage({ stage: 'done' });
  } catch (err) {
    error = (err as Error).message;
    publishStage({ stage: 'failed', error });
  }

  activity.notifyChanged();
  return { error };
}

export function chatRoutes({ root, agent, git, checks, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/chat',
      handle: async (_req, res) => {
        const [thread, { entries }] = await Promise.all([
          readChatFile(root),
          readEntities(campFile(root, 'ideas')),
        ]);
        sendJson(res, 200, { thread: resolveClosedIdeaQuestions(thread, entries) });
      },
    },

    {
      method: 'POST',
      path: '/api/chat',
      handle: async (req, res) => {
        const reqBody = await readBody(req);
        const { text } = JSON.parse(reqBody) as { text?: string };
        if (!text?.trim()) {
          sendJson(res, 400, { error: 'text is required' });
          return;
        }

        await appendUserMessage(root, text.trim());
        const thread = await readChatFile(root);
        const { error } = await runChatReply({ root, agent, git, checks, activity }, thread);
        sendJson(res, 200, { ok: true, ...(error ? { error } : {}) });
      },
    },

    {
      method: 'POST',
      path: '/api/chat/retry',
      handle: async (_req, res) => {
        const thread = await readChatFile(root);
        const { error } = await runChatReply({ root, agent, git, checks, activity }, thread);
        sendJson(res, 200, { ok: true, ...(error ? { error } : {}) });
      },
    },

    {
      method: 'DELETE',
      path: '/api/chat',
      handle: async (_req, res) => {
        await clearChatFile(root);
        activity.notifyChanged();
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
