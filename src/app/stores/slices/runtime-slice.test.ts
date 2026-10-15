import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeReachable } from './runtime-slice';
import type { SetState } from './slice-helpers';

describe('probeReachable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // A fresh --share tunnel, or pairing that landed a moment ago, can leave the very
  // first probe finding nothing — this is the resilience that used to be a single
  // unretried fetch away from a permanent "unreachable" verdict.
  it('succeeds on the first attempt without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(probeReachable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed response and succeeds on the second attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries after a thrown error, not just a non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up as unreachable once every attempt has failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe('checkRuntimeReachable on a self-served origin', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  // `paper-camp dev` has neither a mount prefix nor a dialled runtime, and used to
  // fall straight through to "unreachable" without ever probing its own origin.
  async function reachabilityWith(response: unknown) {
    vi.resetModules();
    vi.doMock('@/app/services/mount', () => ({ mountPrefix: '' }));
    vi.doMock('@/app/services/runtime-connection', () => ({
      getRuntimeConnection: () => ({ runtimeUrl: '', pairingToken: null }),
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    const { createRuntimeSlice } = await import('./runtime-slice');
    const applied: Record<string, unknown>[] = [];
    const set = (patch: Record<string, unknown>) => {
      applied.push(patch);
    };
    const slice = createRuntimeSlice(set as unknown as SetState);
    await slice.checkRuntimeReachable();
    return { slice, applied };
  }

  it('probes rather than assuming unreachable, and accepts a real API', async () => {
    const { applied } = await reachabilityWith({ ok: true, json: async () => ({}) });
    expect(applied.at(-1)).toMatchObject({ runtimeReachable: true });
  });

  it('stays unreachable when the origin has no API at all (a daemon root or hosted bundle 404s)', async () => {
    const { applied } = await reachabilityWith({ ok: false, json: async () => ({}) });
    expect(applied.at(-1)).toMatchObject({ runtimeReachable: false });
  });

  it('starts out checking so the shell does not flash the offline state', async () => {
    const { slice } = await reachabilityWith({ ok: true, json: async () => ({}) });
    expect(slice.runtimeChecking).toBe(true);
  });
});

describe('checkRuntimeReachable reads the current connection, not a load-time snapshot', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('probes the dialled runtime once one is switched to after the module loaded', async () => {
    vi.resetModules();
    vi.doMock('@/app/services/mount', () => ({ mountPrefix: '' }));
    let connection = { runtimeUrl: '', pairingToken: null as string | null };
    vi.doMock('@/app/services/runtime-connection', () => ({
      getRuntimeConnection: () => connection,
    }));
    const servesOwnRuntime = vi.fn().mockResolvedValue(true);
    vi.doMock('@/app/services/hub', () => ({ servesOwnRuntime }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const { createRuntimeSlice } = await import('./runtime-slice');
    connection = { runtimeUrl: 'http://localhost:4444', pairingToken: null };
    const slice = createRuntimeSlice((() => {}) as unknown as SetState);
    await slice.checkRuntimeReachable();

    expect(fetchMock).toHaveBeenCalled();
    expect(servesOwnRuntime).not.toHaveBeenCalled();
  });
});
