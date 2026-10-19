import { beforeAll, describe, expect, it, vi } from 'vitest';

type ActivityPayload = { message?: string; type?: string };
let activityListener: ((payload: ActivityPayload) => void) | undefined;

const refreshProjectState = vi.fn();

vi.mock('./activity-stream', () => ({
  subscribeToActivityStream: vi.fn((listener: (payload: ActivityPayload) => void) => {
    activityListener = listener;
    return () => {};
  }),
}));

vi.mock('./runtime-connection', () => ({
  getRuntimeConnection: () => ({ runtimeUrl: 'http://localhost:1234', pairingToken: null }),
}));

describe('subscribeProjectToActivityStream', () => {
  let mod: typeof import('./query-client');

  beforeAll(async () => {
    mod = await import('./query-client');
    mod.subscribeProjectToActivityStream(refreshProjectState);
  });

  it('subscribes to the current runtime stream', () => {
    expect(activityListener).toBeTypeOf('function');
  });

  it('invalidates every project query and refreshes store state on a "changed" message', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    activityListener?.({ message: 'changed' });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['project', 'http://localhost:1234'],
      refetchType: 'all',
    });
    expect(refreshProjectState).toHaveBeenCalled();
  });

  it('ignores a message that is not "changed"', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    refreshProjectState.mockClear();
    activityListener?.({ message: 'chat' });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(refreshProjectState).not.toHaveBeenCalled();
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
