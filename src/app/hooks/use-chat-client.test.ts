import { describe, expect, it, vi } from 'vitest';
import { isChatChange, mountContextFor, sendClientChat } from './use-chat-client';

describe('mountContextFor', () => {
  it('carries the host route, the focused idea and the viewport', () => {
    expect(
      mountContextFor({ pathname: '/settings' }, { innerWidth: 1280, innerHeight: 800 }, 'IDEA-7'),
    ).toEqual({
      route: '/settings',
      focusedIdeaId: 'IDEA-7',
      viewport: { width: 1280, height: 800 },
    });
  });

  it('omits the focused idea when there is none', () => {
    expect(
      mountContextFor({ pathname: '/' }, { innerWidth: 390, innerHeight: 844 }),
    ).not.toHaveProperty('focusedIdeaId');
  });
});

describe('isChatChange', () => {
  it('reloads on a chat or unscoped change and on a finished turn', () => {
    expect(isChatChange({ message: 'changed', area: 'chat' })).toBe(true);
    expect(isChatChange({ message: 'changed' })).toBe(true);
    expect(isChatChange({ type: 'chat', stage: 'done' })).toBe(true);
    expect(isChatChange({ type: 'chat', stage: 'failed' })).toBe(true);
  });

  it('ignores other areas and live turn events', () => {
    expect(isChatChange({ message: 'changed', area: 'git' })).toBe(false);
    expect(isChatChange({ type: 'chat', stage: 'thinking' })).toBe(false);
    expect(isChatChange({ type: 'chat', chunk: 'Hel' })).toBe(false);
  });
});

describe('sendClientChat', () => {
  const context = { route: '/', viewport: { width: 1, height: 1 } };

  it('posts the message with the mount context, then reloads', async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const load = vi.fn().mockResolvedValue(undefined);

    await expect(sendClientChat('hi', context, { post, load })).resolves.toBeNull();
    expect(post).toHaveBeenCalledWith('hi', context);
    expect(load).toHaveBeenCalledOnce();
  });

  it('returns the one-line error when the post fails, without reloading', async () => {
    const post = vi.fn().mockRejectedValue(new Error('Scout is still answering'));
    const load = vi.fn();

    await expect(sendClientChat('hi', context, { post, load })).resolves.toBe(
      'Scout is still answering',
    );
    expect(load).not.toHaveBeenCalled();
  });
});
