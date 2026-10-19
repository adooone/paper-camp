import type { ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const invalidateCorpus = vi.fn();
const runRunOrderPass = vi.fn();

vi.mock('@/core/corpus', () => ({ invalidateCorpus }));
vi.mock('./run-order-pass', () => ({ runRunOrderPass }));

const { createActivityManager, createEmptyActivityState } = await import('./activity');

function fakeClient(): { res: ServerResponse; writes: string[]; close: () => void } {
  const writes: string[] = [];
  let onClose: (() => void) | undefined;
  const res = {
    write: (data: string) => {
      writes.push(data);
    },
    on: (event: string, cb: () => void) => {
      if (event === 'close') onClose = cb;
    },
  } as unknown as ServerResponse;
  return { res, writes, close: () => onClose?.() };
}

describe('createActivityManager', () => {
  it('sends a changed hello on connect so a redialled client resyncs', () => {
    const activity = createActivityManager('/tmp/papercamp-activity-test');
    const a = fakeClient();
    activity.subscribe(a.res);

    expect(a.writes[0]).toContain('"message":"changed"');
    expect(a.writes[0]).toContain('"type":"activity"');
  });

  it('fans out a published payload to every subscribed client', () => {
    const activity = createActivityManager('/tmp/papercamp-activity-test');
    const a = fakeClient();
    const b = fakeClient();
    activity.subscribe(a.res);
    activity.subscribe(b.res);

    activity.publish({ type: 'service', message: 'service: app' });

    expect(a.writes.at(-1)).toContain('"type":"service"');
    expect(b.writes.at(-1)).toContain('"type":"service"');
  });

  it('drops a client once it closes', () => {
    const activity = createActivityManager('/tmp/papercamp-activity-test');
    const a = fakeClient();
    activity.subscribe(a.res);
    a.close();

    activity.publish({ type: 'check', message: 'check: lint' });

    expect(a.writes).toHaveLength(1); // only the hello message from subscribe
  });

  it('shares its clients with a second instance built against the same state, like a hot-swap', () => {
    const state = createEmptyActivityState();
    const first = createActivityManager('/tmp/papercamp-activity-test', state);
    const a = fakeClient();
    first.subscribe(a.res);

    const second = createActivityManager('/tmp/papercamp-activity-test', first.getState());
    second.publish({ type: 'agent', message: 'agent: running' });

    expect(a.writes.at(-1)).toContain('"type":"agent"');
    expect(second.getState()).toBe(state);
  });

  describe('heartbeat', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('pings every 25 seconds and stops once the client closes', () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      vi.advanceTimersByTime(25_000);
      expect(a.writes.at(-1)).toBe(': ping\n\n');

      vi.advanceTimersByTime(25_000);
      expect(a.writes).toHaveLength(3); // hello + two pings

      a.close();
      vi.advanceTimersByTime(25_000);
      expect(a.writes).toHaveLength(3);
    });
  });

  describe('notifyChanged', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      invalidateCorpus.mockReset();
      runRunOrderPass.mockReset().mockResolvedValue([]);
    });
    afterEach(() => vi.useRealTimers());

    it('invalidates this root’s cache immediately and broadcasts after a 100ms debounce', () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged();
      expect(invalidateCorpus).toHaveBeenCalledWith('/tmp/papercamp-activity-test');
      expect(a.writes).toHaveLength(1); // only the hello

      vi.advanceTimersByTime(100);
      expect(a.writes).toHaveLength(2);
      expect(a.writes.at(-1)).toContain('"message":"changed"');
    });

    it('broadcasts a second tick only once the run-order pass actually changed the list', async () => {
      runRunOrderPass.mockResolvedValue(['IDEA-1']);
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged();
      await vi.advanceTimersByTimeAsync(100); // debounced broadcast
      await vi.advanceTimersByTimeAsync(300); // run-order pass fires
      expect(a.writes).toHaveLength(3); // hello + debounced broadcast + pass broadcast
    });

    it('does not broadcast again when the run-order pass found nothing to change', async () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged();
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(300);
      expect(a.writes).toHaveLength(2); // hello + debounced broadcast only
    });

    it('logs a failed pass once and does not reschedule itself', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      runRunOrderPass.mockRejectedValue(new Error('boom'));
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged();
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(300);
      expect(consoleError).toHaveBeenCalledTimes(1);

      consoleError.mockClear();
      await vi.advanceTimersByTimeAsync(1000);
      expect(consoleError).not.toHaveBeenCalled();
      expect(runRunOrderPass).toHaveBeenCalledTimes(1);

      consoleError.mockRestore();
    });
  });
});
