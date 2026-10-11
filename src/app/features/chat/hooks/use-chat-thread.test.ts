import { describe, expect, it, vi } from 'vitest';
import { sendChatText } from './use-chat-thread';

const deps = (overrides: Partial<Parameters<typeof sendChatText>[2]> = {}) => ({
  postChatMessage: vi.fn().mockResolvedValue({}),
  loadChat: vi.fn().mockResolvedValue(undefined),
  toast: vi.fn(),
  setInput: vi.fn(),
  ...overrides,
});

describe('sendChatText', () => {
  it('resolves true when the message is posted with no error', async () => {
    const d = deps();
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toBe(true);
    expect(d.toast).not.toHaveBeenCalled();
    expect(d.setInput).not.toHaveBeenCalled();
  });

  it('resolves false and toasts when the server reports an error', async () => {
    const d = deps({ postChatMessage: vi.fn().mockResolvedValue({ error: 'boom' }) });
    await expect(sendChatText('hi', { restoreOnFailure: true }, d)).resolves.toBe(false);
    expect(d.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Agent did not reply' }));
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

  it('does not restore the input on throw when restoreOnFailure is false', async () => {
    const d = deps({ postChatMessage: vi.fn().mockRejectedValue(new Error('offline')) });
    await expect(sendChatText('hi', { restoreOnFailure: false }, d)).resolves.toBe(false);
    expect(d.setInput).not.toHaveBeenCalled();
  });
});
