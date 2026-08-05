import { describe, expect, it } from 'vitest';
import type { ThreadMessage } from '../types/index';
import { chatSinceLastLog, promoteThreadMessage } from './thread';

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

describe('chatSinceLastLog', () => {
  it('returns every chat message when the thread has no log entries', () => {
    const thread: ThreadMessage[] = [
      { kind: 'note', text: 'A note' },
      { kind: 'chat', text: 'Hey' },
      { kind: 'chat', text: 'What about this?' },
    ];
    expect(chatSinceLastLog(thread)).toEqual([
      { kind: 'chat', text: 'Hey' },
      { kind: 'chat', text: 'What about this?' },
    ]);
  });

  it('returns only chat messages after the last log entry', () => {
    const thread: ThreadMessage[] = [
      { kind: 'chat', text: 'Earlier exchange' },
      { kind: 'log', text: 'Earlier summary' },
      { kind: 'chat', text: 'New question' },
      { kind: 'question', text: 'A parked question' },
      { kind: 'chat', text: 'New reply' },
    ];
    expect(chatSinceLastLog(thread)).toEqual([
      { kind: 'chat', text: 'New question' },
      { kind: 'chat', text: 'New reply' },
    ]);
  });

  it('returns an empty array when nothing followed the last log entry', () => {
    const thread: ThreadMessage[] = [
      { kind: 'chat', text: 'Earlier exchange' },
      { kind: 'log', text: 'Earlier summary' },
    ];
    expect(chatSinceLastLog(thread)).toEqual([]);
  });

  it('defaults to an empty array for an undefined thread', () => {
    expect(chatSinceLastLog(undefined)).toEqual([]);
  });
});
