import { describe, expect, it } from 'vitest';
import {
  type ChatStageInfo,
  chatStageLine,
  reduceChatStage,
  showsSlowCliHint,
} from './use-chat-stage';

describe('reduceChatStage', () => {
  it('starts a fresh run on reading, recording ideas and the start time', () => {
    const state = reduceChatStage(null, { type: 'chat', stage: 'reading', ideas: 38 }, 1000);
    expect(state).toEqual({ stage: 'reading', ideas: 38, entityId: undefined, startedAt: 1000 });
  });

  it('advances the stage without resetting the start time', () => {
    const reading = reduceChatStage(null, { type: 'chat', stage: 'reading', ideas: 38 }, 1000);
    const deciding = reduceChatStage(reading, { type: 'chat', stage: 'deciding' }, 4000);
    expect(deciding).toEqual({
      stage: 'deciding',
      ideas: undefined,
      entityId: undefined,
      startedAt: 1000,
    });
  });

  it('carries the entity id through the posting stage', () => {
    const state = reduceChatStage(
      null,
      { type: 'chat', stage: 'posting', entityId: 'IDEA-42' },
      1000,
    );
    expect(state?.entityId).toBe('IDEA-42');
  });

  it('clears the state on done', () => {
    const reading = reduceChatStage(null, { type: 'chat', stage: 'reading', ideas: 1 }, 1000);
    expect(reduceChatStage(reading, { type: 'chat', stage: 'done' }, 2000)).toBeNull();
  });

  it('clears the state on failed', () => {
    const reading = reduceChatStage(null, { type: 'chat', stage: 'reading', ideas: 1 }, 1000);
    expect(
      reduceChatStage(reading, { type: 'chat', stage: 'failed', error: 'boom' }, 2000),
    ).toBeNull();
  });

  it('a later reading event restarts the clock', () => {
    const first = reduceChatStage(null, { type: 'chat', stage: 'reading', ideas: 1 }, 1000);
    const second = reduceChatStage(first, { type: 'chat', stage: 'reading', ideas: 2 }, 9000);
    expect(second).toEqual({ stage: 'reading', ideas: 2, entityId: undefined, startedAt: 9000 });
  });
});

describe('chatStageLine', () => {
  const info = (overrides: Partial<ChatStageInfo>): ChatStageInfo => ({
    stage: 'deciding',
    elapsedSeconds: 0,
    ...overrides,
  });

  it('names the ideas count while reading', () => {
    expect(chatStageLine(info({ stage: 'reading', ideas: 38 }))).toBe('Reading 38 ideas…');
  });

  it('defaults the ideas count to 0 when absent', () => {
    expect(chatStageLine(info({ stage: 'reading' }))).toBe('Reading 0 ideas…');
  });

  it('names the entity while posting', () => {
    expect(chatStageLine(info({ stage: 'posting', entityId: 'IDEA-42' }))).toBe(
      'Posting to IDEA-42…',
    );
  });

  it('reads "Filing an idea…" while filing', () => {
    expect(chatStageLine(info({ stage: 'filing' }))).toBe('Filing an idea…');
  });

  it('reads "Answering…" while answering', () => {
    expect(chatStageLine(info({ stage: 'answering' }))).toBe('Answering…');
  });

  it('omits the elapsed seconds under 5 s', () => {
    expect(chatStageLine(info({ stage: 'deciding', elapsedSeconds: 4 }))).toBe('Deciding…');
  });

  it('carries the elapsed seconds from 5 s', () => {
    expect(chatStageLine(info({ stage: 'deciding', elapsedSeconds: 12 }))).toBe('Deciding… 12 s');
  });
});

describe('showsSlowCliHint', () => {
  it('is false under 30 s', () => {
    expect(showsSlowCliHint({ stage: 'deciding', elapsedSeconds: 29 })).toBe(false);
  });

  it('is true from 30 s', () => {
    expect(showsSlowCliHint({ stage: 'deciding', elapsedSeconds: 30 })).toBe(true);
  });
});
