import { describe, expect, it } from 'vitest';
import {
  type ChatEvent,
  type ChatTurnState,
  chatStageLine,
  reduceChatPermission,
  reduceChatTurn,
  showsSlowCliHint,
  visibleChatTurn,
} from './use-chat-stage';

const event = (fields: Omit<ChatEvent, 'type'>): ChatEvent => ({ type: 'chat', ...fields });

const play = (events: ChatEvent[], threadLength = 1, now = 1000): ChatTurnState | null =>
  events.reduce<ChatTurnState | null>(
    (state, e) => reduceChatTurn(state, e, now, threadLength),
    null,
  );

describe('reduceChatTurn', () => {
  it('starts a fresh turn on reading', () => {
    expect(play([event({ stage: 'reading' })])).toEqual({
      stage: 'reading',
      startedAt: 1000,
      text: '',
      tools: [],
    });
  });

  it('carries the streamed text and tool lines', () => {
    const state = play([
      event({ stage: 'reading' }),
      event({ stage: 'thinking' }),
      event({ tool: 'Reading src/app/server/routes/chat.ts' }),
      event({ stage: 'replying' }),
      event({ chunk: 'The chat' }),
      event({ chunk: 'The chat routes live in chat.ts' }),
    ]);
    expect(state).toMatchObject({
      stage: 'replying',
      text: 'The chat routes live in chat.ts',
      tools: ['Reading src/app/server/routes/chat.ts'],
    });
  });

  it('keeps the start time as the stage advances', () => {
    const reading = reduceChatTurn(null, event({ stage: 'reading' }), 1000, 1);
    const thinking = reduceChatTurn(reading, event({ stage: 'thinking' }), 4000, 1);
    expect(thinking?.startedAt).toBe(1000);
  });

  it('records the thread length a turn ended at', () => {
    const state = play([event({ stage: 'reading' }), event({ chunk: 'Hi' })], 3);
    expect(reduceChatTurn(state, event({ stage: 'done' }), 2000, 3)).toMatchObject({
      stage: 'done',
      text: 'Hi',
      endedAtLength: 3,
    });
    expect(reduceChatTurn(state, event({ stage: 'failed', error: 'boom' }), 2000, 3)).toMatchObject(
      { stage: 'failed', endedAtLength: 3 },
    );
  });

  it('ignores an end event with no turn in flight', () => {
    expect(play([event({ stage: 'done' })])).toBeNull();
  });

  it('picks up a turn already under way from its first chunk', () => {
    expect(play([event({ chunk: 'Half a reply' })])).toMatchObject({
      stage: 'replying',
      text: 'Half a reply',
    });
  });

  it('a later reading event restarts the turn', () => {
    const first = play([event({ stage: 'reading' }), event({ chunk: 'old' })]);
    expect(reduceChatTurn(first, event({ stage: 'reading' }), 9000, 1)).toEqual({
      stage: 'reading',
      startedAt: 9000,
      text: '',
      tools: [],
    });
  });
});

describe('visibleChatTurn', () => {
  const live: ChatTurnState = { stage: 'replying', startedAt: 0, text: 'Hi', tools: [] };

  it('shows a live turn whatever the thread length', () => {
    expect(visibleChatTurn(live, 7)).toBe(live);
  });

  it('keeps an ended turn until the reply lands on the thread', () => {
    const ended = { ...live, stage: 'done' as const, endedAtLength: 4 };
    expect(visibleChatTurn(ended, 4)).toBe(ended);
    expect(visibleChatTurn(ended, 5)).toBeNull();
  });
});

describe('reduceChatPermission', () => {
  const ask = { tool: 'Bash', target: 'pnpm test' };

  it('holds the first denied tool of a turn', () => {
    const first = reduceChatPermission(null, event({ permission: ask }));
    expect(first).toEqual(ask);
    expect(reduceChatPermission(first, event({ permission: { tool: 'WebFetch' } }))).toEqual(ask);
  });

  it('outlives the end of the turn and clears when the next one starts', () => {
    expect(reduceChatPermission(ask, event({ stage: 'done' }))).toEqual(ask);
    expect(reduceChatPermission(ask, event({ stage: 'reading' }))).toBeNull();
  });
});

describe('chatStageLine', () => {
  it('names the stage', () => {
    expect(chatStageLine('reading', 0)).toBe('Reading…');
    expect(chatStageLine('thinking', 0)).toBe('Thinking…');
    expect(chatStageLine('replying', 0)).toBe('Replying…');
  });

  it('carries the elapsed seconds from 5 s', () => {
    expect(chatStageLine('thinking', 4)).toBe('Thinking…');
    expect(chatStageLine('thinking', 12)).toBe('Thinking… 12 s');
  });
});

describe('showsSlowCliHint', () => {
  it('shows from 30 s while the turn is live', () => {
    expect(showsSlowCliHint({ live: true, elapsedSeconds: 29 })).toBe(false);
    expect(showsSlowCliHint({ live: true, elapsedSeconds: 30 })).toBe(true);
  });

  it('never shows once the turn has ended', () => {
    expect(showsSlowCliHint({ live: false, elapsedSeconds: 90 })).toBe(false);
  });
});
