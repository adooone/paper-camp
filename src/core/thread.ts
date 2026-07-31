import type { LogEntry, MarginNote, ThreadMessage, ThreadMessageKind } from '../types/index';

/** Folds the four legacy sections into one ordered thread: dated entries (log,
 * clarification, review) sort chronologically; notes never carried a date, so they
 * land after, in their original order. A phase anchor has no place in a flat thread —
 * its context is folded into the message text instead of lost. */
export function threadFromLegacy(
  log: LogEntry[] = [],
  clarifications: LogEntry[] = [],
  notes: MarginNote[] = [],
  review: LogEntry[] = [],
): ThreadMessage[] {
  const dated: ThreadMessage[] = [
    ...log.map((e) => ({ kind: 'log' as const, date: e.date, text: e.text })),
    ...clarifications.map((e) => ({ kind: 'clarification' as const, date: e.date, text: e.text })),
    ...review.map((e) => ({ kind: 'review' as const, date: e.date, text: e.text })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const undated: ThreadMessage[] = notes.map((n) => ({
    kind: n.kind ?? 'note',
    text: n.anchor.kind === 'phase' ? `[phase ${n.anchor.index}] ${n.prose}` : n.prose,
    state: n.state,
  }));

  return [...dated, ...undated];
}

function threadKindEntries(thread: ThreadMessage[], kind: ThreadMessageKind): LogEntry[] {
  return thread.filter((m) => m.kind === kind).map((m) => ({ date: m.date ?? '', text: m.text }));
}

export function logFromThread(thread: ThreadMessage[] = []): LogEntry[] {
  return threadKindEntries(thread, 'log');
}

export function clarificationsFromThread(thread: ThreadMessage[] = []): LogEntry[] {
  return threadKindEntries(thread, 'clarification');
}

export function reviewFromThread(thread: ThreadMessage[] = []): LogEntry[] {
  return threadKindEntries(thread, 'review');
}

export function notesFromThread(thread: ThreadMessage[] = []): MarginNote[] {
  return thread
    .filter(
      (m): m is ThreadMessage & { kind: 'note' | 'decision' | 'question' } =>
        m.kind === 'note' || m.kind === 'decision' || m.kind === 'question',
    )
    .map((m) => ({
      anchor: { kind: 'body' as const },
      prose: m.text,
      state: m.state ?? 'open',
      kind: m.kind,
    }));
}

/** Replaces every message of the given kinds with `next`, keeping the rest of the
 * thread untouched — used when a legacy write path (PATCH log/notes/review) sends a
 * full replacement array for one of the old sections. */
export function replaceThreadKinds(
  thread: ThreadMessage[] | undefined,
  kinds: ThreadMessageKind[],
  next: ThreadMessage[],
): ThreadMessage[] {
  return [...(thread ?? []).filter((m) => !kinds.includes(m.kind)), ...next];
}
