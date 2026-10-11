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
