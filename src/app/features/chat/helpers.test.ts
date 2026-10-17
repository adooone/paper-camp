import type { ScopeRow } from '@/app/features/scope';
import type { ThreadMessage } from '@/types/index';
import { describe, expect, it } from 'vitest';
import {
  isNearBottom,
  isSendKey,
  mergeScopedChatMessages,
  threadEndsWithUserMessage,
} from './helpers';

const project = (name: string) => ({ name }) as unknown as ScopeRow;

const msg = (date: string | undefined, text: string): ThreadMessage => ({
  kind: 'chat',
  ...(date ? { date } : {}),
  text,
});

describe('mergeScopedChatMessages', () => {
  it('sorts on the full date string, interleaving same-day messages by minute', () => {
    const own = [msg('2026-10-16T14:05', 'own later')];
    const foreign = [
      { project: project('other'), messages: [msg('2026-10-16T14:02', 'foreign earlier')] },
    ];
    const merged = mergeScopedChatMessages(own, foreign, project('mine'));
    expect(merged.map((m) => m.message.text)).toEqual(['foreign earlier', 'own later']);
  });

  it('sorts a date-only line before any minute-precision time on the same day', () => {
    const own = [msg('2026-10-16T00:01', 'has a time'), msg('2026-10-16', 'date only')];
    const merged = mergeScopedChatMessages(own, [], project('mine'));
    expect(merged.map((m) => m.message.text)).toEqual(['date only', 'has a time']);
  });
});

describe('isNearBottom', () => {
  it('is true exactly at the threshold', () => {
    expect(isNearBottom({ scrollTop: 20, scrollHeight: 300, clientHeight: 200 })).toBe(true);
  });

  it('is false just past the threshold', () => {
    expect(isNearBottom({ scrollTop: 19, scrollHeight: 300, clientHeight: 200 })).toBe(false);
  });

  it('is true when already at the very bottom', () => {
    expect(isNearBottom({ scrollTop: 100, scrollHeight: 300, clientHeight: 200 })).toBe(true);
  });
});

describe('isSendKey', () => {
  it('is true for a plain Enter', () => {
    expect(isSendKey({ key: 'Enter', shiftKey: false })).toBe(true);
  });

  it('is false for Shift+Enter', () => {
    expect(isSendKey({ key: 'Enter', shiftKey: true })).toBe(false);
  });

  it('is false for any other key', () => {
    expect(isSendKey({ key: 'a', shiftKey: false })).toBe(false);
  });
});

describe('threadEndsWithUserMessage', () => {
  it('is false for an empty thread', () => {
    expect(threadEndsWithUserMessage([])).toBe(false);
  });

  it('is true when the last message is a chat message with no reply yet', () => {
    expect(threadEndsWithUserMessage([msg(undefined, 'hi')])).toBe(true);
  });

  it('is false once an agent reply has landed', () => {
    const reply: ThreadMessage = { kind: 'chat', text: 'got it', from: 'agent' };
    expect(threadEndsWithUserMessage([msg(undefined, 'hi'), reply])).toBe(false);
  });

  it('is false when the thread ends on a parked question', () => {
    const question: ThreadMessage = { kind: 'question', text: 'which idea?', from: 'agent' };
    expect(threadEndsWithUserMessage([msg(undefined, 'hi'), question])).toBe(false);
  });
});
