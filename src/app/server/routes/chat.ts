import { readCorpus } from '@/core/corpus';
import { resolveClosedIdeaQuestions } from '@/core/parked-questions';
import { agentThreadMessage, nowMinuteString } from '@/core/serialize';
import type { AgentTaskState, ChatPermissionAsk, ChatPermissionChoice } from '@/types/index';
import { allowAlways, permissionChoiceText } from '../chat-permission';
import { clearChatSession } from '../chat-session';
import { tryHandleGitChatRequest } from '../git-chat';
import { appendToChatFile, clearChatFile, readChatFile } from '../helpers';
import { readJson, sendJson } from '../http';
import type { Route, RouteContext } from './types';

type ChatTurnContext = Pick<RouteContext, 'root' | 'agent' | 'git' | 'activity'>;

const BUSY_ERROR = 'Scout is still answering the previous message';
const SETTLED: AgentTaskState['status'][] = ['done', 'error', 'superseded'];

function appendAgentMessage(root: string, text: string): Promise<void> {
  return appendToChatFile(
    root,
    agentThreadMessage(text, 'chat', undefined, undefined, nowMinuteString()),
  );
}

function chatBusy(agent: RouteContext['agent']): boolean {
  return agent
    .getStatus()
    .some((task) => task.taskKind === 'chat' && !SETTLED.includes(task.status));
}

async function branchContext(git: RouteContext['git']) {
  try {
    const { branch, entries } = await git.getStatusSnapshot();
    return { name: branch, dirty: entries.map((entry) => entry.path) };
  } catch {
    return undefined;
  }
}

const CHOICES: ChatPermissionChoice[] = ['once', 'always', 'skip'];

async function startTurn(
  { root, agent, git, activity }: ChatTurnContext,
  text: string,
  allow?: ChatPermissionAsk[],
) {
  const turn = agent.runChatTurn(text, {
    branch: await branchContext(git),
    ...(allow && { allow }),
  });
  void turn
    .catch((err: Error) => err.message || 'Scout failed without an error message')
    .then(async (reply) => {
      await appendAgentMessage(root, reply);
      activity.notifyChanged(['chat', 'corpus']);
    })
    .catch(() => {});
}

export function chatRoutes({ root, agent, git, activity }: RouteContext): Route[] {
  const ctx = { root, agent, git, activity };
  return [
    {
      method: 'GET',
      path: '/api/chat',
      handle: async (_req, res) => {
        const [thread, { entries }] = await Promise.all([readChatFile(root), readCorpus(root)]);
        sendJson(res, 200, { thread: resolveClosedIdeaQuestions(thread, entries) });
      },
    },

    {
      method: 'POST',
      path: '/api/chat',
      handle: async (req, res) => {
        const { text } = (await readJson<{ text?: string }>(req)) ?? {};
        const trimmed = text?.trim();
        if (!trimmed) {
          sendJson(res, 400, { error: 'text is required' });
          return;
        }
        if (chatBusy(agent)) {
          sendJson(res, 409, { error: BUSY_ERROR });
          return;
        }

        await appendToChatFile(root, { kind: 'chat', date: nowMinuteString(), text: trimmed });
        activity.notifyChanged('chat');
        const gitReply = await tryHandleGitChatRequest('project-chat', trimmed, git, agent);
        if (gitReply.handled) {
          await appendAgentMessage(root, gitReply.reply ?? '');
          activity.notifyChanged('chat');
          sendJson(res, 200, { ok: true });
          return;
        }
        await startTurn(ctx, trimmed);
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/chat/retry',
      handle: async (_req, res) => {
        if (chatBusy(agent)) {
          sendJson(res, 409, { error: BUSY_ERROR });
          return;
        }
        const last = (await readChatFile(root)).findLast(
          (message) => message.from !== 'agent' && message.kind === 'chat',
        );
        if (!last?.text.trim()) {
          sendJson(res, 400, { error: 'no message to retry' });
          return;
        }
        await startTurn(ctx, last.text.trim());
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'POST',
      path: '/api/chat/allow',
      handle: async (req, res) => {
        const body =
          (await readJson<{ tool?: string; target?: string; choice?: string }>(req)) ?? {};
        const tool = body.tool?.trim();
        const choice = CHOICES.find((c) => c === body.choice);
        if (!tool || !choice) {
          sendJson(res, 400, { error: 'tool and a choice of once, always or skip are required' });
          return;
        }
        if (chatBusy(agent)) {
          sendJson(res, 409, { error: BUSY_ERROR });
          return;
        }
        const target = body.target?.trim();
        const ask: ChatPermissionAsk = { tool, ...(target && { target }) };
        if (choice === 'always') {
          try {
            await allowAlways(root, ask);
          } catch (err) {
            sendJson(res, 500, { error: (err as Error).message });
            return;
          }
        }
        const text = permissionChoiceText(choice, ask);
        await appendToChatFile(root, { kind: 'chat', date: nowMinuteString(), text });
        activity.notifyChanged('chat');
        await startTurn(ctx, text, choice === 'skip' ? undefined : [ask]);
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'DELETE',
      path: '/api/chat',
      handle: async (_req, res) => {
        await Promise.all([clearChatFile(root), clearChatSession(root)]);
        activity.notifyChanged('chat');
        sendJson(res, 200, { ok: true });
      },
    },
  ];
}
