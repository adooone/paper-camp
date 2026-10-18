import { beforeAll, describe, expect, it, vi } from 'vitest';

type ActivityPayload = { message?: string; type?: string };
let activityListener: ((payload: ActivityPayload) => void) | undefined;

vi.mock('./activity-stream', () => ({
  subscribeToActivityStream: vi.fn((listener: (payload: ActivityPayload) => void) => {
    activityListener = listener;
    return () => {};
  }),
}));

vi.mock('./runtime-connection', () => ({
  getRuntimeConnection: () => ({ runtimeUrl: 'http://localhost:1234', pairingToken: null }),
}));

describe('subscribeChatToActivityStream', () => {
  let mod: typeof import('./query-client');

  beforeAll(async () => {
    mod = await import('./query-client');
    mod.subscribeChatToActivityStream();
  });

  it('subscribes to the current runtime stream', () => {
    expect(activityListener).toBeTypeOf('function');
  });

  it('invalidates the chat query when a "changed" message arrives', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    activityListener?.({ message: 'changed' });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mod.chatQueryKey('http://localhost:1234'),
      refetchType: 'all',
    });
  });

  it('ignores a message that is not "changed"', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    activityListener?.({ message: 'chat' });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('refreshCi invalidates the current runtime ci query', async () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    await mod.refreshCi();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mod.ciQueryKey('http://localhost:1234'),
      refetchType: 'all',
    });
  });
});
