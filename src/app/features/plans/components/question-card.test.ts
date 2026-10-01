import type { ThreadMessageOption } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { runPick, runSendReply } from './question-card';

const option: ThreadMessageOption = { label: 'Ship it', consequence: '' };

describe('runPick', () => {
  it('sets chosen when onAnswer resolves true', async () => {
    const setChosen = vi.fn();
    await runPick(option, vi.fn().mockResolvedValue(true), { setSending: vi.fn(), setChosen });
    expect(setChosen).toHaveBeenCalledWith('Ship it');
  });

  it('leaves chosen unset so the card stays retryable when onAnswer resolves false', async () => {
    const setChosen = vi.fn();
    await runPick(option, vi.fn().mockResolvedValue(false), { setSending: vi.fn(), setChosen });
    expect(setChosen).not.toHaveBeenCalled();
  });
});

describe('runSendReply', () => {
  it('sets chosen and clears the reply when onAnswer resolves true', async () => {
    const setChosen = vi.fn();
    const setReply = vi.fn();
    await runSendReply('sounds good', vi.fn().mockResolvedValue(true), {
      setSending: vi.fn(),
      setChosen,
      setReply,
    });
    expect(setChosen).toHaveBeenCalledWith('sounds good');
    expect(setReply).toHaveBeenCalledWith('');
  });

  it('leaves chosen and reply unset so the user can retry when onAnswer resolves false', async () => {
    const setChosen = vi.fn();
    const setReply = vi.fn();
    await runSendReply('sounds good', vi.fn().mockResolvedValue(false), {
      setSending: vi.fn(),
      setChosen,
      setReply,
    });
    expect(setChosen).not.toHaveBeenCalled();
    expect(setReply).not.toHaveBeenCalled();
  });

  it('does nothing for blank input', async () => {
    const onAnswer = vi.fn();
    await runSendReply('   ', onAnswer, {
      setSending: vi.fn(),
      setChosen: vi.fn(),
      setReply: vi.fn(),
    });
    expect(onAnswer).not.toHaveBeenCalled();
  });
});
