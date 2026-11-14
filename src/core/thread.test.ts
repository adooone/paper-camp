import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '../types/index';
import { promoteThreadMessage } from './thread';

describe('promoteThreadMessage', () => {
  const thread: ThreadMessage[] = [
    { kind: 'chat', date: '2026-08-01', text: 'What should we do about X?', from: 'user' },
    { kind: 'chat', date: '2026-08-01', text: "Let's go with Y.", from: 'agent' },
  ];

  it('promotes a chat message to a decision, opened', () => {
    const result = promoteThreadMessage(thread, 1, 'decision');
    expect(result[1]).toEqual({
      kind: 'decision',
      date: '2026-08-01',
      text: "Let's go with Y.",
      from: 'agent',
      state: 'open',
    });
    expect(result[0]).toEqual(thread[0]);
  });

  it('promotes a chat message to a log entry, dropping any state', () => {
    const result = promoteThreadMessage(thread, 1, 'log');
    expect(result[1]).toEqual({
      kind: 'log',
      date: '2026-08-01',
      text: "Let's go with Y.",
      from: 'agent',
    });
  });

  it('appends a note to the promoted message text', () => {
    const result = promoteThreadMessage(thread, 1, 'log', 'Captured as IDEA-131: New idea');
    expect(result[1].text).toBe("Let's go with Y.\n\nCaptured as IDEA-131: New idea");
  });

  it('leaves every other message untouched', () => {
    const result = promoteThreadMessage(thread, 0, 'log');
    expect(result[1]).toEqual(thread[1]);
  });
});
