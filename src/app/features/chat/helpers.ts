import type { ScopeRow } from '@/app/features/scope';
import type { ThreadMessage } from '@/types/index';

const EPOCH = new Date(0).toISOString();

export interface ScopedChatMessage {
  message: ThreadMessage;
  index: number;
  project?: ScopeRow;
}

/** Merges the current project's thread with every other scope project's by time
 * (IDEA-293), oldest first, so a conversation across projects still reads top to
 * bottom. A non-time-sortable message (no `date`) settles at the very start. */
export function mergeScopedChatMessages(
  own: ThreadMessage[],
  foreign: { project: ScopeRow; messages: ThreadMessage[] }[],
  ownProject: ScopeRow | undefined,
): ScopedChatMessage[] {
  const ownScoped = own.map((message, index) => ({ message, index, project: ownProject }));
  const foreignScoped = foreign.flatMap(({ project, messages }) =>
    messages.map((message, index) => ({ message, index, project })),
  );
  return [...ownScoped, ...foreignScoped].sort((a, b) =>
    (a.message.date ?? EPOCH).localeCompare(b.message.date ?? EPOCH),
  );
}

const NEAR_BOTTOM_PX = 80;

export function isNearBottom(
  el: { scrollTop: number; scrollHeight: number; clientHeight: number },
  thresholdPx = NEAR_BOTTOM_PX,
): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= thresholdPx;
}

export function isSendKey(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === 'Enter' && !e.shiftKey;
}

// Mirrors the server's nowMinuteString (@/core/serialize) rather than importing it, so
// the pending bubble's timestamp matches the stored copy without pulling server code
// into the browser bundle.
export function nowMinuteString(): string {
  return new Date().toISOString().slice(0, 16);
}
