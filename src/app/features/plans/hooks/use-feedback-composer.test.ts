import { describe, expect, it, vi } from 'vitest';
import { runHandleAnswer } from './use-feedback-composer';

describe('runHandleAnswer', () => {
  it('propagates true from onSend', async () => {
    const setPending = vi.fn();
    await expect(runHandleAnswer('hi', vi.fn().mockResolvedValue(true), setPending)).resolves.toBe(
      true,
    );
    expect(setPending).toHaveBeenNthCalledWith(1, 'hi');
    expect(setPending).toHaveBeenNthCalledWith(2, null);
  });

  it('propagates false from onSend', async () => {
    const setPending = vi.fn();
    await expect(runHandleAnswer('hi', vi.fn().mockResolvedValue(false), setPending)).resolves.toBe(
      false,
    );
    expect(setPending).toHaveBeenNthCalledWith(1, 'hi');
    expect(setPending).toHaveBeenNthCalledWith(2, null);
  });
});
