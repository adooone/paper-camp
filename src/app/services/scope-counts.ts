import { isUnansweredQuestion } from '@/core/chat-file';
import type { Notification, ThreadMessage, WorklistEntry } from '@/types/index';

export function openIdeasCount(worklist: WorklistEntry[] | null | undefined): number | null {
  return worklist ? worklist.filter((entry) => entry.status === 'open').length : null;
}

export function unreadActivityCount(
  notifications: Notification[] | null | undefined,
): number | null {
  return notifications
    ? notifications.filter((n) => n.kind === 'question' || !n.read).length
    : null;
}

export function unansweredChatCount(thread: ThreadMessage[] | null | undefined): number | null {
  return thread ? thread.filter(isUnansweredQuestion).length : null;
}
