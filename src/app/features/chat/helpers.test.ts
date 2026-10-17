import type { ScopeRow } from '@/app/features/scope';
import type { ThreadMessage } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { mergeScopedChatMessages } from './helpers';

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
