import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '../types/index';
import { appendChatMessage, formatChatFile, parseChatFile, trimChatMessages } from './chat-file';

describe('parseChatFile', () => {
  it('parses messages from the ### Thread grammar', () => {
    const content =
      '### Thread\n- [x] 2026-09-11 [chat] Hello\n- [x] 2026-09-11 [chat] [agent] Hi\n';
    expect(parseChatFile(content)).toEqual([
      { kind: 'chat', date: '2026-09-11', text: 'Hello' },
      { kind: 'chat', date: '2026-09-11', text: 'Hi', from: 'agent' },
    ]);
  });

  it('returns an empty list for empty content', () => {
    expect(parseChatFile('')).toEqual([]);
  });

  it('parses a parked question carrying its entity id', () => {
    const content =
      '### Thread\n- [ ] 2026-09-11 [question] [agent] [[IDEA-42]] Which auth flow?\n';
    expect(parseChatFile(content)).toEqual([
      {
        kind: 'question',
        date: '2026-09-11',
        text: 'Which auth flow?',
        from: 'agent',
        state: 'open',
        entityId: 'IDEA-42',
      },
    ]);
  });
});

describe('formatChatFile', () => {
  it('round-trips through parse', () => {
    const messages: ThreadMessage[] = [
      { kind: 'chat', date: '2026-09-11', text: 'Hello' },
      { kind: 'chat', date: '2026-09-11', text: 'Hi', from: 'agent' },
    ];
    expect(parseChatFile(formatChatFile(messages))).toEqual(messages);
  });

  it('returns an empty string for an empty list', () => {
    expect(formatChatFile([])).toBe('');
  });

  it('round-trips a parked question carrying its entity id', () => {
    const messages: ThreadMessage[] = [
      {
        kind: 'question',
        date: '2026-09-11',
        text: 'Which auth flow?',
        from: 'agent',
        state: 'open',
        entityId: 'IDEA-42',
      },
    ];
    expect(parseChatFile(formatChatFile(messages))).toEqual(messages);
  });
});

describe('trimChatMessages', () => {
  const now = new Date('2026-09-11T00:00:00Z');

  it('keeps everything under both limits', () => {
    const messages: ThreadMessage[] = [{ kind: 'chat', date: '2026-09-10', text: 'Hi' }];
    expect(trimChatMessages(messages, now)).toEqual(messages);
  });

  it('trims to the last 50 messages when that leaves fewer than the age cutoff', () => {
    const messages: ThreadMessage[] = Array.from({ length: 60 }, (_, i) => ({
      kind: 'chat' as const,
      date: '2026-09-11',
      text: `msg ${i}`,
    }));
    const trimmed = trimChatMessages(messages, now);
    expect(trimmed).toHaveLength(50);
    expect(trimmed[0].text).toBe('msg 10');
  });

  it('trims to the last 14 days when that leaves fewer than 50 messages', () => {
    const messages: ThreadMessage[] = [
      { kind: 'chat', date: '2026-08-01', text: 'old' },
      { kind: 'chat', date: '2026-09-10', text: 'recent' },
    ];
    expect(trimChatMessages(messages, now)).toEqual([
      { kind: 'chat', date: '2026-09-10', text: 'recent' },
    ]);
  });

  it('never drops an unanswered question, regardless of age', () => {
    const messages: ThreadMessage[] = [
      { kind: 'question', date: '2026-01-01', text: 'Still open?', state: 'open' },
      { kind: 'chat', date: '2026-09-10', text: 'recent' },
    ];
    expect(trimChatMessages(messages, now)).toEqual(messages);
  });

  it('trims a resolved question like any other message', () => {
    const messages: ThreadMessage[] = [
      { kind: 'question', date: '2026-01-01', text: 'Resolved', state: 'resolved' },
      { kind: 'chat', date: '2026-09-10', text: 'recent' },
    ];
    expect(trimChatMessages(messages, now)).toEqual([
      { kind: 'chat', date: '2026-09-10', text: 'recent' },
    ]);
  });
});

describe('appendChatMessage', () => {
  const now = new Date('2026-09-11T00:00:00Z');

  it('appends a message and trims the result', () => {
    const content = formatChatFile([{ kind: 'chat', date: '2026-08-01', text: 'old' }]);
    const next = appendChatMessage(content, { kind: 'chat', date: '2026-09-11', text: 'new' }, now);
    expect(parseChatFile(next)).toEqual([{ kind: 'chat', date: '2026-09-11', text: 'new' }]);
  });

  it('starts a new thread from empty content', () => {
    const next = appendChatMessage('', { kind: 'chat', date: '2026-09-11', text: 'first' }, now);
    expect(parseChatFile(next)).toEqual([{ kind: 'chat', date: '2026-09-11', text: 'first' }]);
  });
});
