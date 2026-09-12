import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { loadPushStore, savePushStore } from './push-store';

const sendNotification = vi.fn();
vi.mock('web-push', () => ({
  default: { sendNotification: (...args: unknown[]) => sendNotification(...args) },
}));

const { sendPushForProject } = await import('./push-send');

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

afterEach(() => {
  sendNotification.mockReset();
  vi.unstubAllGlobals();
});

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-push-send-'));
  dirs.push(dir);
  return { storePath: join(dir, 'push.json'), vapidKeysPath: join(dir, 'vapid.json') };
}

const payload = {
  id: 'notif-1',
  kind: 'completed' as const,
  entityId: 'IDEA-1',
  entityTitle: 'First',
  text: 'run failed',
};

describe('sendPushForProject', () => {
  it('does nothing when there are no subscriptions for the project', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    await savePushStore(storePath, { version: 1, subscriptions: [] });
    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to a webpush subscription and stamps lastDeliveryAt on success', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    sendNotification.mockResolvedValue(undefined);
    const record = {
      transport: 'webpush' as const,
      root: '/repo/a',
      name: 'Chrome',
      subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
    };
    await savePushStore(storePath, { version: 1, subscriptions: [record] });

    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const stored = await loadPushStore(storePath);
    expect(stored.subscriptions[0]?.lastDeliveryAt).toEqual(expect.any(String));
  });

  it('drops a webpush subscription the transport reports gone', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    sendNotification.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const record = {
      transport: 'webpush' as const,
      root: '/repo/a',
      name: 'Chrome',
      subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
    };
    await savePushStore(storePath, { version: 1, subscriptions: [record] });

    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });

    const stored = await loadPushStore(storePath);
    expect(stored.subscriptions).toEqual([]);
  });

  it('leaves a subscription in place when delivery merely fails', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    sendNotification.mockRejectedValue(new Error('network error'));
    const record = {
      transport: 'webpush' as const,
      root: '/repo/a',
      name: 'Chrome',
      subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
    };
    await savePushStore(storePath, { version: 1, subscriptions: [record] });

    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });

    const stored = await loadPushStore(storePath);
    expect(stored.subscriptions).toEqual([record]);
  });

  it('sends to an expo subscription over fetch and drops it on DeviceNotRegistered', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const record = {
      transport: 'expo' as const,
      root: '/repo/a',
      name: 'Phone',
      token: 'ExponentPushToken[x]',
    };
    await savePushStore(storePath, { version: 1, subscriptions: [record] });

    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.any(Object),
    );
    const stored = await loadPushStore(storePath);
    expect(stored.subscriptions).toEqual([]);
  });

  it('only sends to subscriptions for the matching project', async () => {
    const { storePath, vapidKeysPath } = await makeStore();
    sendNotification.mockResolvedValue(undefined);
    const other = {
      transport: 'webpush' as const,
      root: '/repo/b',
      name: 'Other',
      subscription: { endpoint: 'https://push.example/2', keys: { p256dh: 'p', auth: 'a' } },
    };
    await savePushStore(storePath, { version: 1, subscriptions: [other] });

    await sendPushForProject('/repo/a', payload, { storePath, vapidKeysPath });

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
