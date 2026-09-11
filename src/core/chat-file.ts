import type { ThreadMessage } from '../types/index';
import { THREAD_SECTION } from './sections';

const MAX_MESSAGES = 50;
const MAX_AGE_DAYS = 14;

export function parseChatFile(content: string): ThreadMessage[] {
  const lines = content.split('\n');
  return THREAD_SECTION.parseEntries(lines, 0, lines.length);
}

export function formatChatFile(messages: ThreadMessage[]): string {
  if (messages.length === 0) return '';
  return `${THREAD_SECTION.formatLines(messages).join('\n')}\n`;
}

function isUnansweredQuestion(message: ThreadMessage): boolean {
  return message.kind === 'question' && message.state === 'open';
}

/** Trims to the last 50 messages and to nothing older than 14 days, whichever leaves
 * fewer, but keeps every unanswered question regardless of age or position — it is
 * the one inbox for the agent's questions and a trim must never silently drop one. */
export function trimChatMessages(messages: ThreadMessage[], now: Date): ThreadMessage[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const byCount = messages.slice(Math.max(0, messages.length - MAX_MESSAGES));
  const byAge = messages.filter((message) => !message.date || message.date >= cutoffDate);
  const kept = new Set(byAge.length < byCount.length ? byAge : byCount);

  return messages.filter((message) => kept.has(message) || isUnansweredQuestion(message));
}

export function appendChatMessage(
  content: string,
  message: ThreadMessage,
  now: Date = new Date(),
): string {
  return formatChatFile(trimChatMessages([...parseChatFile(content), message], now));
}
