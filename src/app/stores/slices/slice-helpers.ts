import type { StoreApi } from 'zustand';
import type { AppStore } from '../app-store';

export type SetState = StoreApi<AppStore>['setState'];
export type GetState = StoreApi<AppStore>['getState'];

// Collapses the fetch → set-on-success → fallback-on-error shape every load-slice below
// re-spelled by hand; `loadingKey` is only needed by slices that show a spinner meanwhile.
export function loadSlice<T>(
  set: SetState,
  fetcher: () => Promise<T>,
  apply: (data: T) => Partial<AppStore>,
  fallback: (err: unknown) => Partial<AppStore> = () => ({}),
  loadingKey?: keyof AppStore,
): () => Promise<void> {
  return async () => {
    if (loadingKey) set({ [loadingKey]: true } as Partial<AppStore>);
    try {
      const data = await fetcher();
      set({ ...apply(data), ...(loadingKey && { [loadingKey]: false }) });
    } catch (err) {
      set({ ...fallback(err), ...(loadingKey && { [loadingKey]: false }) });
    }
  };
}

// Every launch thunk kicks off an agent task then re-polls agentStatus so callers see it
// appear immediately instead of waiting for the next poll tick.
export function withAgentPoll<Args extends unknown[]>(
  get: GetState,
  action: (...args: Args) => Promise<unknown>,
): (...args: Args) => Promise<void> {
  return async (...args: Args) => {
    await action(...args);
    await get().loadAgentStatus();
  };
}
