import type { ActivityMessage } from '@/app/services/activity-stream';
import { subscribeToActivityStream } from '@/app/services/activity-stream';
import { useEffect, useState } from 'react';

export type ChatStage = 'reading' | 'deciding' | 'filing' | 'posting' | 'answering';

const CHAT_STAGES = new Set<string>([
  'reading',
  'deciding',
  'filing',
  'posting',
  'answering',
  'done',
  'failed',
]);

interface ChatStagePayload extends ActivityMessage {
  type: 'chat';
  stage: ChatStage | 'done' | 'failed';
  ideas?: number;
  entityId?: string;
  error?: string;
}

function isChatStagePayload(payload: ActivityMessage): payload is ChatStagePayload {
  const stage = (payload as { stage?: unknown }).stage;
  return payload.type === 'chat' && typeof stage === 'string' && CHAT_STAGES.has(stage);
}

interface ChatStageState {
  stage: ChatStage;
  ideas?: number;
  entityId?: string;
  startedAt: number;
}

export function reduceChatStage(
  state: ChatStageState | null,
  event: ChatStagePayload,
  now: number,
): ChatStageState | null {
  if (event.stage === 'done' || event.stage === 'failed') return null;
  return {
    stage: event.stage,
    ideas: event.ideas,
    entityId: event.entityId,
    startedAt: event.stage === 'reading' ? now : (state?.startedAt ?? now),
  };
}

export interface ChatStageInfo {
  stage: ChatStage;
  ideas?: number;
  entityId?: string;
  elapsedSeconds: number;
}

const STAGE_LINES: Record<ChatStage, (info: ChatStageInfo) => string> = {
  reading: (info) => `Reading ${info.ideas ?? 0} ideas…`,
  deciding: () => 'Deciding…',
  filing: () => 'Filing an idea…',
  posting: (info) => `Posting to ${info.entityId ?? ''}…`,
  answering: () => 'Answering…',
};

const ELAPSED_SECONDS_HINT_THRESHOLD = 5;
const SLOW_CLI_HINT_THRESHOLD = 30;

export function chatStageLine(info: ChatStageInfo): string {
  const line = STAGE_LINES[info.stage](info);
  return info.elapsedSeconds >= ELAPSED_SECONDS_HINT_THRESHOLD
    ? `${line} ${info.elapsedSeconds} s`
    : line;
}

export function showsSlowCliHint(info: ChatStageInfo): boolean {
  return info.elapsedSeconds >= SLOW_CLI_HINT_THRESHOLD;
}

const TICK_MS = 1000;

export function useChatStage(active: boolean): ChatStageInfo | null {
  const [state, setState] = useState<ChatStageState | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      setState(null);
      return;
    }
    return subscribeToActivityStream((payload) => {
      if (!isChatStagePayload(payload)) return;
      setState((current) => reduceChatStage(current, payload, Date.now()));
    });
  }, [active]);

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  if (!active || !state) return null;
  return {
    stage: state.stage,
    ideas: state.ideas,
    entityId: state.entityId,
    elapsedSeconds: Math.max(0, Math.floor((now - state.startedAt) / 1000)),
  };
}
