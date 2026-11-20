import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { threadEndsWithUserMessage, withIdeaPrefix } from '@/app/features/chat/helpers';
import { type ChatTurnInfo, useChatStage } from '@/app/features/chat/hooks/use-chat-stage';
import { useChat } from '@/app/hooks/use-chat';
import { useEntity } from '@/app/hooks/use-entity';
import {
  fetchEntity,
  postChatMessage,
  postChatPermission,
  postChatRetry,
} from '@/app/services/content';
import { refreshChat } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import {
  firstOpenPhase,
  ideaTasks,
  isLiveTask,
  taskEntityId,
  walkEndMessage,
  walkIndex,
} from '@/app/stores/plan-walk';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { ChatPermissionAsk, ChatPermissionChoice } from '@/types/index';
import {
  type ChatItem,
  chatItems,
  type DeliveryStatus,
  newestUserMessageId,
  newOutboxEntry,
  type OutboxEntry,
  parseCommand,
  pendingQuestion,
  placeholderFor,
} from '../shell/chat-model';
import { useAgentStatusStream } from './use-agent-status-stream';
import { useProjectName } from './use-project-name';

export type ChatLoad = 'loading' | 'unreachable' | 'ready';

export interface ChatScreenState {
  load: ChatLoad;
  projectName: string | null;
  items: ChatItem[];
  outbox: OutboxEntry[];
  turn: ChatTurnInfo | null;
  permission: ChatPermissionAsk | null;
  newestUserId: string | null;
  delivery: DeliveryStatus | null;
  draft: string;
  placeholder: string;
  sending: boolean;
  error: string | null;
  notice: string | null;
  walk: { index: number } | null;
  walkTotal: number;
  walkMessage: string | null;
  setDraft: (value: string) => void;
  send: () => void;
  retryTurn: () => void;
  retryOutbox: (entry: OutboxEntry) => void;
  choose: (choice: ChatPermissionChoice) => void;
  openIdea: (ideaId: string) => void;
  stopWalk: () => void;
  reload: () => void;
}

interface ChatScreenOptions {
  about: string | undefined;
  onAboutConsumed: () => void;
}

const failure = (cause: unknown): string =>
  cause instanceof Error ? oneLineErrorSummary(cause.message) : 'Action failed.';

export function useChatScreen({ about, onAboutConsumed }: ChatScreenOptions): ChatScreenState {
  useAgentStatusStream();
  const projectName = useProjectName();
  const { chatThread, chatError } = useChat();
  const agentStatus = useAppStore((state) => state.agentStatus);
  const loadAgentStatus = useAppStore((state) => state.loadAgentStatus);
  const launchAgent = useAppStore((state) => state.launchAgent);
  const launchRunAll = useAppStore((state) => state.launchRunAll);
  const stopAgent = useAppStore((state) => state.stopAgent);
  const thread = useMemo(() => chatThread ?? [], [chatThread]);
  const { turn, permission, dismissPermission } = useChatStage(thread.length);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxEntry[]>([]);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [walkMessage, setWalkMessage] = useState<string | null>(null);
  const sawWalk = useRef(false);

  const items = useMemo(() => chatItems(thread), [thread]);
  const question = pendingQuestion(items);
  const walkTask = useMemo(
    () => agentStatus.find((task) => isLiveTask(task) && task.taskKind === 'run-all') ?? null,
    [agentStatus],
  );
  const walkId = walkTask ? (taskEntityId(walkTask) ?? null) : commandId;
  const walkEntity = useEntity(walkId);
  const phases = useMemo(() => walkEntity.data?.phases ?? [], [walkEntity.data]);
  if (walkTask) sawWalk.current = true;
  const walk = walkIndex(walkTask, starting, phases);

  const ended = walkId ? ideaTasks(agentStatus, walkId).ended : null;
  const endMessage = ended ? walkEndMessage(ended) : null;
  useEffect(() => {
    if (sawWalk.current && endMessage) setWalkMessage(endMessage);
  }, [endMessage]);

  const reload = useCallback(async () => {
    await Promise.all([loadAgentStatus(), refreshChat()]);
  }, [loadAgentStatus]);

  useEffect(() => {
    if (!about) return;
    setDraft((current) => withIdeaPrefix(current, about));
    onAboutConsumed();
  }, [about, onAboutConsumed]);

  const deliver = useCallback(async (entry: OutboxEntry) => {
    setSending(true);
    setError(null);
    setOutbox((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, status: 'sending', error: undefined } : item,
      ),
    );
    try {
      await postChatMessage(entry.text);
      await refreshChat();
      setOutbox((current) => current.filter((item) => item.id !== entry.id));
    } catch (cause) {
      setOutbox((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status: 'failed', error: failure(cause) } : item,
        ),
      );
    } finally {
      setSending(false);
    }
  }, []);

  const retryTurn = useCallback(() => {
    setError(null);
    postChatRetry()
      .then(refreshChat)
      .catch((cause) => setError(failure(cause)));
  }, []);

  const choose = useCallback(
    (choice: ChatPermissionChoice) => {
      if (!permission) return;
      setError(null);
      postChatPermission(choice, permission)
        .then(() => {
          dismissPermission();
          return refreshChat();
        })
        .catch((cause) => setError(failure(cause)));
    },
    [permission, dismissPermission],
  );

  const runCommand = useCallback(
    async (command: 'next' | 'all', ideaId: string | undefined) => {
      if (!ideaId) {
        setError(`Name the idea: /${command} IDEA-N`);
        return;
      }
      setCommandId(ideaId);
      setWalkMessage(null);
      try {
        if (command === 'all') {
          setStarting(true);
          await launchRunAll(ideaId);
          await reload();
          return;
        }
        const entity = await fetchEntity(ideaId);
        const index = firstOpenPhase(entity.phases);
        if (index < 0) {
          setError('Every phase is already done.');
          return;
        }
        await launchAgent(ideaId, index);
        setNotice(`Launched phase ${index + 1} of ${ideaId}.`);
        await reload();
      } catch (cause) {
        setError(command === 'all' ? `Run all could not start: ${failure(cause)}` : failure(cause));
      } finally {
        setStarting(false);
      }
    },
    [launchAgent, launchRunAll, reload],
  );

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setNotice(null);
    setDraft('');
    const command = parseCommand(text);
    if (command) {
      void runCommand(command.command, command.ideaId);
      return;
    }
    const entry = newOutboxEntry(text, new Date());
    setOutbox((current) => [...current, entry]);
    void deliver(entry);
  }, [draft, sending, runCommand, deliver]);

  const openIdea = useCallback(
    (ideaId: string) => setDraft((current) => withIdeaPrefix(current, ideaId)),
    [],
  );

  const stopWalk = useCallback(() => {
    if (!walkTask) return;
    stopAgent(walkTask.id)
      .then(reload)
      .catch((cause) => setWalkMessage(failure(cause)));
  }, [stopAgent, walkTask, reload]);

  const load: ChatLoad = chatThread ? 'ready' : chatError ? 'unreachable' : 'loading';
  const chatRunning = agentStatus.some((task) => task.taskKind === 'chat' && isLiveTask(task));
  const failed =
    !sending && !chatRunning && !turn && outbox.length === 0 && threadEndsWithUserMessage(thread);
  const delivery: DeliveryStatus | null = failed ? 'failed' : turn?.live ? 'reading' : null;

  return {
    load,
    projectName,
    items,
    outbox,
    turn,
    permission,
    newestUserId: newestUserMessageId(items),
    delivery,
    draft,
    placeholder: placeholderFor(question),
    sending,
    error,
    notice,
    walk,
    walkTotal: phases.length,
    walkMessage,
    setDraft,
    send,
    retryTurn,
    retryOutbox: (entry) => void deliver(entry),
    choose,
    openIdea,
    stopWalk,
    reload: () => void reload(),
  };
}
