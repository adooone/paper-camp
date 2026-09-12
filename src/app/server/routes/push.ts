import { pushSubscribeBodySchema, pushUnsubscribeBodySchema } from '@/core/parse';
import {
  type PushSubscriptionRecord,
  defaultPushStorePath,
  loadPushStore,
  removeSubscription,
  savePushStore,
  subscriptionKey,
  subscriptionsForProject,
  upsertSubscription,
  withPushStoreLock,
} from '@/core/push-store';
import { defaultVapidKeysPath, loadOrMintVapidKeys } from '@/core/vapid-keys';
import { readBody, sendJson } from '../http';
import type { Route, RouteContext } from './types';

export function pushRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/push/public-key',
      handle: async (_req, res) => {
        const { publicKey } = await loadOrMintVapidKeys(defaultVapidKeysPath());
        sendJson(res, 200, { publicKey });
      },
    },
    {
      method: 'GET',
      path: '/api/push/subscriptions',
      handle: async (_req, res) => {
        const store = await loadPushStore(defaultPushStorePath());
        const devices = subscriptionsForProject(store, root).map((record) => ({
          transport: record.transport,
          name: record.name,
          lastDeliveryAt: record.lastDeliveryAt,
          key: subscriptionKey(record),
        }));
        sendJson(res, 200, devices);
      },
    },
    {
      method: 'POST',
      path: '/api/push/subscribe',
      handle: async (req, res) => {
        let body: unknown;
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        const parsed = pushSubscribeBodySchema.safeParse(body);
        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }
        const record: PushSubscriptionRecord = { ...parsed.data, root };
        await withPushStoreLock(async () => {
          const path = defaultPushStorePath();
          const store = await loadPushStore(path);
          await savePushStore(path, upsertSubscription(store, record));
        });
        sendJson(res, 200, { ok: true });
      },
    },
    {
      method: 'DELETE',
      path: '/api/push/subscribe',
      handle: async (req, res) => {
        let body: unknown;
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          sendJson(res, 400, { error: 'invalid JSON body' });
          return;
        }
        const parsed = pushUnsubscribeBodySchema.safeParse(body);
        if (!parsed.success) {
          sendJson(res, 400, { error: parsed.error.message });
          return;
        }
        const key = parsed.data.transport === 'webpush' ? parsed.data.endpoint : parsed.data.token;
        const removed = await withPushStoreLock(async () => {
          const path = defaultPushStorePath();
          const store = await loadPushStore(path);
          const outcome = removeSubscription(store, root, parsed.data.transport, key);
          await savePushStore(path, outcome.store);
          return outcome.removed;
        });
        sendJson(res, 200, { ok: true, removed });
      },
    },
  ];
}
