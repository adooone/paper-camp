import { describe, expect, it, vi } from 'vitest';
import { retryChatReply, sendChatText } from './use-chat-thread';

const deps = (overrides: Partial<Parameters<typeof sendChatText>[2]> = {}) => ({
  postChatMessage: vi.fn().mockResolvedValue({}),
  loadChat: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
  setInput: vi.fn(),
  ...overrides,
});

describe('sendChatText', () => {
  it('resolves ok with no error when the message is posted with no error', async () => {
    const d = deps();
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toEqual({
      ok: true,
      error: undefined,
    });
    expect(d.toast).not.toHaveBeenCalled();
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('resolves not ok with the error when the server reports an error, without toasting', async () => {
    const d = deps({ postChatMessage: vi.fn().mockResolvedValue({ error: 'boom' }) });
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toEqual({
      ok: false,
      error: 'boom',
    });
    expect(d.toast).not.toHaveBeenCalled();
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('resolves not ok and restores the input when posting throws and restoreOnFailure is set', async () => {
    const d = deps({ postChatMessage: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toEqual({
      ok: false,
    });
    expect(d.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Message failed to send' }),
    );
    expect(d.setInput).toHaveBeenCalledTimes(1);
  });

  it('does not restore the input on throw when restoreOnFailure is false', async () => {
    const d = deps({ postChatMessage: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(sendChatText('hi', { restoreOnFailure: false }, d)).resolves.toEqual({
      ok: false,
    });
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('awaits loadChat fully before resolving, so a caller clearing pending state after the call sees a settled refetch — including a foreign send whose loadChat is a target-project refetch', async () => {
    let settled = false;
    const d = deps({
      loadChat: vi.fn(
        () =>
          new Promise<void>((resolve) =>
            setTimeout(() => {
              settled = true;
              resolve();
            }, 0),
          ),
      ),
    });
    await sendChatText('hi', { restoreOnFailure: true }, d);
    expect(settled).toBe(true);
  });
});

describe('retryChatReply', () => {
  const retryDeps = (overrides: Partial<Parameters<typeof retryChatReply>[0]> = {}) => ({
    postChatRetry: vi.fn().mockResolvedValue({}),
    loadChat: vi.fn().mockResolvedValue(undefined),
    toast: vi.fn(),
    ...overrides,
  });

  it('resolves ok with no error when the retry succeeds, without toasting', async () => {
    const d = retryDeps();
    await expect(retryChatReply(d)).resolves.toEqual({ ok: true, error: undefined });
    expect(d.toast).not.toHaveBeenCalled();
  });

  it('resolves not ok with the error when the agent run fails again, without toasting', async () => {
    const d = retryDeps({ postChatRetry: vi.fn().mockResolvedValue({ error: 'boom' }) });
    await expect(retryChatReply(d)).resolves.toEqual({ ok: false, error: 'boom' });
    expect(d.toast).not.toHaveBeenCalled();
  });

  it('resolves not ok and toasts when the retry request itself throws', async () => {
    const d = retryDeps({ postChatRetry: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(retryChatReply(d)).resolves.toEqual({ ok: false });
    expect(d.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Message failed to send' }),
    );
  });
});
