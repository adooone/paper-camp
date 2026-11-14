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
  it('sends a hello, not a change, on connect', () => {
    const activity = createActivityManager('/tmp/papercamp-activity-test');
    const a = fakeClient();
    activity.subscribe(a.res);

    expect(a.writes[0]).toContain('"message":"hello"');
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

  it('calls every change listener on notifyChanged until it unsubscribes', () => {
    const activity = createActivityManager('/tmp/papercamp-activity-test');
    const listener = vi.fn();
    const off = activity.onChange(listener);

    activity.notifyChanged('git');
    off();
    activity.notifyChanged('git');

    expect(listener).toHaveBeenCalledTimes(1);
    activity.close();
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

    it('clears its own interval once a ping write throws', () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      let writeCount = 0;
      const res = {
        write: () => {
          writeCount += 1;
          if (writeCount > 1) throw new Error('client gone');
        },
        on: () => {},
      } as unknown as ServerResponse;
      activity.subscribe(res);

      vi.advanceTimersByTime(25_000);
      expect(writeCount).toBe(2); // hello, then the first ping throws

      vi.advanceTimersByTime(50_000);
      expect(writeCount).toBe(2); // interval is dead, no further pings attempted
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

      activity.notifyChanged('corpus');
      expect(invalidateCorpus).toHaveBeenCalledWith('/tmp/papercamp-activity-test');
      expect(a.writes).toHaveLength(1); // only the hello

      vi.advanceTimersByTime(100);
      expect(a.writes).toHaveLength(2);
      expect(a.writes.at(-1)).toContain('"message":"changed"');
      expect(a.writes.at(-1)).toContain('"area":"corpus"');
    });

    it('debounces per area and leaves the corpus cache alone for other areas', () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged('chat');
      activity.notifyChanged('chat');
      activity.notifyChanged('git');
      expect(invalidateCorpus).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(a.writes).toHaveLength(3);
      expect(a.writes.filter((w) => w.includes('"area":"chat"'))).toHaveLength(1);
      expect(a.writes.filter((w) => w.includes('"area":"git"'))).toHaveLength(1);
    });

    it('broadcasts each area of a multi-area change', () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged(['chat', 'corpus']);
      expect(invalidateCorpus).toHaveBeenCalledOnce();

      vi.advanceTimersByTime(100);
      expect(a.writes.some((w) => w.includes('"area":"chat"'))).toBe(true);
      expect(a.writes.some((w) => w.includes('"area":"corpus"'))).toBe(true);
    });

    it('broadcasts a second tick only once the run-order pass actually changed the list', async () => {
      runRunOrderPass.mockResolvedValue(['IDEA-1']);
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged('corpus');
      await vi.advanceTimersByTimeAsync(100); // debounced broadcast
      await vi.advanceTimersByTimeAsync(300); // run-order pass fires
      expect(a.writes).toHaveLength(3); // hello + debounced broadcast + pass broadcast
    });

    it('does not broadcast again when the run-order pass found nothing to change', async () => {
      const activity = createActivityManager('/tmp/papercamp-activity-test');
      const a = fakeClient();
      activity.subscribe(a.res);

      activity.notifyChanged('corpus');
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

      activity.notifyChanged('corpus');
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
