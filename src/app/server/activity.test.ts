import type { ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createActivityManager, createEmptyActivityState } from './activity';

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
});
