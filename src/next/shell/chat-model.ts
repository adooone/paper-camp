import type { ChatStage } from '@/app/features/chat/hooks/use-chat-stage';
import type { ChatPermissionAsk, ThreadMessage } from '@/types/index';
import type { StampMeaning } from '../ui/stamp';

export type DeliveryStatus = 'sending' | 'reading' | 'failed';

export interface ChatItem {
  id: string;
  message: ThreadMessage;
}

export interface OutboxEntry {
  id: string;
  text: string;
  date: string;
  status: 'sending' | 'failed';
  error?: string;
}

export const TAIL_LINES = 6;

export const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  sending: 'Sending…',
  reading: 'Scout is reading',
  failed: 'Failed to send — tap to retry',
};

export const STAGE_LABEL: Record<ChatStage, string> = {
  reading: 'Scout is reading…',
  thinking: 'Scout is thinking…',
  replying: 'Scout is replying…',
};

export const PERMISSION_CHOICES = [
  { choice: 'once', label: 'Allow once' },
  { choice: 'always', label: 'Always allow' },
  { choice: 'skip', label: 'Skip' },
] as const;

const COMMAND = /^\/(next|all)\b\s*(IDEA-\d+)?/i;

const CHAT_KINDS: ThreadMessage['kind'][] = [
  'chat',
  'note',
  'decision',
  'question',
  'clarification',
];

export function chatItems(thread: ThreadMessage[]): ChatItem[] {
  const seen = new Map<string, number>();
  return thread
    .filter((message) => CHAT_KINDS.includes(message.kind))
    .map((message) => {
      const dateKey = message.date ?? 'x';
      const index = seen.get(dateKey) ?? 0;
      seen.set(dateKey, index + 1);
      return { id: `chat:${dateKey}:${index}`, message };
    });
}

export const newestUserMessageId = (items: ChatItem[]): string | null =>
  items.findLast((item) => item.message.from !== 'agent' && item.message.kind === 'chat')?.id ??
  null;

export const pendingQuestion = (items: ChatItem[]): ThreadMessage | null =>
  items.findLast((item) => item.message.kind === 'question' && item.message.state !== 'resolved')
    ?.message ?? null;

export function bubbleStamp(message: ThreadMessage): { meaning: StampMeaning; label: string } {
  const fromYou = message.from !== 'agent';
  const meaning: StampMeaning = fromYou ? 'done' : 'parked';
  if (message.kind === 'decision') return { meaning, label: 'decision' };
  if (message.kind === 'note') return { meaning, label: 'note' };
  return { meaning, label: fromYou ? 'you' : 'agent' };
}

export const messageTime = (date: string | undefined): string => {
  if (!date) return '';
  return date.includes('T') ? date.slice(11, 16) : date;
};

export const permissionPrompt = (ask: ChatPermissionAsk): string =>
  `Run \`${ask.target ?? ask.tool}\`?`;

export const placeholderFor = (question: ThreadMessage | null): string =>
  question ? "Answer Scout's question…" : 'Chat with Scout';

export const emptyLine = (projectName: string | null): string =>
  `Ask Scout about ${projectName ?? 'this project'}, or tell it what to file.`;

export interface ChatCommand {
  command: 'next' | 'all';
  ideaId: string | undefined;
}

export function parseCommand(text: string): ChatCommand | null {
  const match = COMMAND.exec(text);
  if (!match) return null;
  return {
    command: match[1]?.toLowerCase() === 'all' ? 'all' : 'next',
    ideaId: match[2]?.toUpperCase(),
  };
}

export const newOutboxEntry = (text: string, now: Date): OutboxEntry => ({
  id: `pending:${now.getTime()}:${Math.random().toString(36).slice(2, 6)}`,
  text,
  date: now.toISOString().slice(0, 16),
  status: 'sending',
});
