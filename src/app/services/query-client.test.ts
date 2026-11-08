import { beforeAll, describe, expect, it, vi } from 'vitest';

type ActivityPayload = { message?: string; type?: string; area?: string };
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

  it('invalidates only the keys of the named area and leaves project state alone for corpus', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    refreshProjectState.mockClear();
    activityListener?.({ message: 'changed', area: 'chat' });
    expect(invalidateSpy).toHaveBeenCalledOnce();
    const { predicate } = invalidateSpy.mock.calls[0]?.[0] ?? {};
    const matches = (resource: string) =>
      predicate?.({ queryKey: ['project', 'http://localhost:1234', resource] } as never) ?? false;
    expect(matches('chat')).toBe(true);
    expect(matches('worklist')).toBe(false);
    expect(refreshProjectState).not.toHaveBeenCalled();
  });

  it('refreshes project state for git and services', () => {
    refreshProjectState.mockClear();
    activityListener?.({ message: 'changed', area: 'git' });
    activityListener?.({ message: 'changed', area: 'services' });
    expect(refreshProjectState).toHaveBeenCalledTimes(2);
  });

  it('ignores a hello', () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    invalidateSpy.mockClear();
    refreshProjectState.mockClear();
    activityListener?.({ message: 'hello' });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(refreshProjectState).not.toHaveBeenCalled();
  });

  it('does not refetch on window focus', () => {
    expect(mod.queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
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

  it('refreshCapacity invalidates the current runtime capacity query', async () => {
    const invalidateSpy = vi.spyOn(mod.queryClient, 'invalidateQueries');
    await mod.refreshCapacity();
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: mod.capacityQueryKey('http://localhost:1234'),
      refetchType: 'all',
    });
  });
});
