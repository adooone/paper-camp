import { describe, expect, it, vi } from 'vitest';
import { answerChatPermission, retryChatReply, sendChatText } from './use-chat-thread';

const deps = (overrides: Partial<Parameters<typeof sendChatText>[2]> = {}) => ({
  postChatMessage: vi.fn().mockResolvedValue(undefined),
  loadChat: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
  setInput: vi.fn(),
  ...overrides,
});

describe('sendChatText', () => {
  it('resolves true once the server acks', async () => {
    const d = deps();
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toBe(true);
    expect(d.toast).not.toHaveBeenCalled();
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('resolves false and restores the input when posting throws and restoreOnFailure is set', async () => {
    const d = deps({ postChatMessage: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toBe(false);
    expect(d.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Message failed to send' }),
    );
    expect(d.setInput).toHaveBeenCalledTimes(1);
  });

  it('toasts the busy refusal and keeps the draft', async () => {
    const setInput = vi.fn();
    const d = deps({
      setInput,
      postChatMessage: vi
        .fn()
        .mockRejectedValue(new Error('Scout is still answering the previous message')),
    });
    await expect(sendChatText('again', { restoreOnFailure: true }, d)).resolves.toBe(false);
    expect(d.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Scout is still answering the previous message' }),
    );
    expect(setInput.mock.calls[0][0]('')).toBe('again');
  });

  it('does not restore the input on throw when restoreOnFailure is false', async () => {
    const d = deps({ postChatMessage: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(sendChatText('hi', { restoreOnFailure: false }, d)).resolves.toBe(false);
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('calls onPosted once the message is posted but before loadChat resolves, so the optimistic bubble clears before the real message would render twice', async () => {
    const order: string[] = [];
    const d = deps({
      postChatMessage: vi.fn(async () => {
        order.push('posted');
      }),
      loadChat: vi.fn(async () => {
        order.push('loaded');
      }),
      onPosted: vi.fn(() => order.push('onPosted')),
    });
    await sendChatText('hi', { restoreOnFailure: true }, d);
    expect(order).toEqual(['posted', 'onPosted', 'loaded']);
  });

  it('does not call onPosted when posting throws', async () => {
    const d = deps({
      postChatMessage: vi.fn().mockRejectedValue(new Error('offline')),
      onPosted: vi.fn(),
    });
    await sendChatText('hi', { restoreOnFailure: true }, d);
    expect(d.onPosted).not.toHaveBeenCalled();
  });
});

describe('retryChatReply', () => {
  const retryDeps = (overrides: Partial<Parameters<typeof retryChatReply>[0]> = {}) => ({
    postChatRetry: vi.fn().mockResolvedValue(undefined),
    loadChat: vi.fn().mockResolvedValue(undefined),
    toast: vi.fn(),
    ...overrides,
  });

  it('resolves true when the retry is acked, without toasting', async () => {
    const d = retryDeps();
    await expect(retryChatReply(d)).resolves.toBe(true);
    expect(d.toast).not.toHaveBeenCalled();
  });

  it('resolves false and toasts when the retry request itself throws', async () => {
    const d = retryDeps({ postChatRetry: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(retryChatReply(d)).resolves.toBe(false);
    expect(d.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Message failed to send' }),
    );
  });
});

describe('answerChatPermission', () => {
  const ask = { tool: 'Bash', target: 'pnpm test' };
  const permissionDeps = (overrides: Partial<Parameters<typeof answerChatPermission>[2]> = {}) => ({
    postChatPermission: vi.fn().mockResolvedValue(undefined),
    loadChat: vi.fn().mockResolvedValue(undefined),
    toast: vi.fn(),
    ...overrides,
  });

  it.each(['once', 'always', 'skip'] as const)(
    'posts the %s choice and reloads',
    async (choice) => {
      const d = permissionDeps();
      await expect(answerChatPermission(choice, ask, d)).resolves.toBe(true);
      expect(d.postChatPermission).toHaveBeenCalledWith(choice, ask);
      expect(d.loadChat).toHaveBeenCalledOnce();
    },
  );

  it('toasts and resolves false when the choice fails to post', async () => {
    const d = permissionDeps({
      postChatPermission: vi
        .fn()
        .mockRejectedValue(new Error('settings.json is not a JSON object')),
    });
    await expect(answerChatPermission('always', ask, d)).resolves.toBe(false);
    expect(d.toast).toHaveBeenCalledOnce();
    expect(d.loadChat).not.toHaveBeenCalled();
  });
});
