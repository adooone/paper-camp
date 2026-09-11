import { agentThreadMessage, todayDateString } from '@/core/serialize';
import type { ThreadMessage } from '@/types/index';
import { replyToChat } from '../chat-reply';
import { appendToChatFile, clearChatFile, readChatFile } from '../helpers';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function chatRoutes({ root, agent, activity }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/chat',
      handle: async (_req, res) => {
        const thread = await readChatFile(root);
        sendJson(res, 200, { thread });
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

        const userMessage: ThreadMessage = {
          kind: 'chat',
          date: todayDateString(),
          text: text.trim(),
        };
        await appendToChatFile(root, userMessage);

        let error: string | undefined;
        try {
          const thread = await readChatFile(root);
          const replyText = await replyToChat(thread, agent.runChatReply);
          await appendToChatFile(root, agentThreadMessage(replyText, 'chat'));
        } catch (err) {
          error = (err as Error).message;
        }

        activity.notifyChanged();
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
