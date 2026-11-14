import type { ActivityMessage } from '@/app/services/activity-stream';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import type { ChatPermissionAsk } from '@/types/index';
import { useEffect, useRef, useState } from 'react';

export type ChatStage = 'reading' | 'thinking' | 'replying';

type ChatEndStage = 'done' | 'failed';

export interface ChatEvent extends ActivityMessage {
  type: 'chat';
  tool?: string;
  permission?: ChatPermissionAsk;
}

export interface ChatTurnState {
  stage: ChatStage | ChatEndStage;
  startedAt: number;
  text: string;
  tools: string[];
  endedAtLength?: number;
}

const LIVE_STAGES = new Set<string>(['reading', 'thinking', 'replying']);
const END_STAGES = new Set<string>(['done', 'failed']);

function isChatEvent(payload: ActivityMessage): payload is ChatEvent {
  return payload.type === 'chat';
}

const freshTurn = (stage: ChatStage, now: number): ChatTurnState => ({
  stage,
  startedAt: now,
  text: '',
  tools: [],
});

export function reduceChatTurn(
  state: ChatTurnState | null,
  event: ChatEvent,
  now: number,
  threadLength: number,
): ChatTurnState | null {
  const { stage } = event;
  if (stage === 'reading') return freshTurn('reading', now);
  if (stage && END_STAGES.has(stage)) {
    return state ? { ...state, stage: stage as ChatEndStage, endedAtLength: threadLength } : null;
  }
  const current =
    state && state.endedAtLength === undefined
      ? state
      : freshTurn(typeof event.chunk === 'string' ? 'replying' : 'thinking', now);
  if (stage && LIVE_STAGES.has(stage)) return { ...current, stage: stage as ChatStage };
  if (typeof event.chunk === 'string') return { ...current, text: event.chunk };
  if (typeof event.tool === 'string') return { ...current, tools: [...current.tools, event.tool] };
  return state;
}

export function reduceChatPermission(
  ask: ChatPermissionAsk | null,
  event: ChatEvent,
): ChatPermissionAsk | null {
  if (event.stage === 'reading') return null;
  return ask ?? event.permission ?? null;
}

export function visibleChatTurn(
  state: ChatTurnState | null,
  threadLength: number,
): ChatTurnState | null {
  if (!state) return null;
  if (state.endedAtLength === undefined) return state;
  return state.endedAtLength === threadLength ? state : null;
}

export interface ChatTurnInfo {
  live: boolean;
  stage: ChatStage | null;
  text: string;
  tools: string[];
  elapsedSeconds: number;
}

const STAGE_LINES: Record<ChatStage, string> = {
  reading: 'Reading…',
  thinking: 'Thinking…',
  replying: 'Replying…',
};

const ELAPSED_SECONDS_HINT_THRESHOLD = 5;
const SLOW_CLI_HINT_THRESHOLD = 30;

export function chatStageLine(stage: ChatStage, elapsedSeconds: number): string {
  const line = STAGE_LINES[stage];
  return elapsedSeconds >= ELAPSED_SECONDS_HINT_THRESHOLD ? `${line} ${elapsedSeconds} s` : line;
}

export function showsSlowCliHint(turn: Pick<ChatTurnInfo, 'live' | 'elapsedSeconds'>): boolean {
  return turn.live && turn.elapsedSeconds >= SLOW_CLI_HINT_THRESHOLD;
}

const TICK_MS = 1000;

export function useChatStage(threadLength: number) {
  const [turn, setTurn] = useState<ChatTurnState | null>(null);
  const [permission, setPermission] = useState<ChatPermissionAsk | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const lengthRef = useRef(threadLength);
  lengthRef.current = threadLength;

  useEffect(
    () =>
      subscribeToActivityStream((payload) => {
        if (!isChatEvent(payload)) return;
        setTurn((current) => reduceChatTurn(current, payload, Date.now(), lengthRef.current));
        setPermission((current) => reduceChatPermission(current, payload));
      }),
    [],
  );

  const visible = visibleChatTurn(turn, threadLength);
  const live = visible !== null && visible.endedAtLength === undefined;

  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [live]);

  const info: ChatTurnInfo | null = visible && {
    live,
    stage: live ? (visible.stage as ChatStage) : null,
    text: visible.text,
    tools: visible.tools,
    elapsedSeconds: Math.max(0, Math.floor((now - visible.startedAt) / 1000)),
  };

  return { turn: info, permission, dismissPermission: () => setPermission(null) };
}
