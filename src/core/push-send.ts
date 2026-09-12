import webpush from 'web-push';
import type { StoredNotificationKind } from '../types/index';
import {
  type PushSubscriptionRecord,
  defaultPushStorePath,
  loadPushStore,
  removeSubscription,
  savePushStore,
  subscriptionKey,
  subscriptionsForProject,
  withPushStoreLock,
} from './push-store';
import { defaultVapidKeysPath, loadOrMintVapidKeys } from './vapid-keys';

const VAPID_SUBJECT = 'mailto:paper-camp@localhost';

export interface PushPayload {
  id: string;
  kind: StoredNotificationKind;
  entityId: string;
  entityTitle: string;
  text: string;
}

export interface SendPushOptions {
  storePath?: string;
  vapidKeysPath?: string;
}

type DeliveryOutcome = 'delivered' | 'gone' | 'failed';

async function sendWebPush(
  record: Extract<PushSubscriptionRecord, { transport: 'webpush' }>,
  payload: PushPayload,
  vapid: { publicKey: string; privateKey: string },
): Promise<DeliveryOutcome> {
  try {
    await webpush.sendNotification(record.subscription, JSON.stringify(payload), {
      vapidDetails: {
        subject: VAPID_SUBJECT,
        publicKey: vapid.publicKey,
        privateKey: vapid.privateKey,
      },
    });
    return 'delivered';
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) return 'gone';
    console.error(`paper-camp: web push delivery failed for ${record.name}:`, err);
    return 'failed';
  }
}

async function sendExpoPush(
  record: Extract<PushSubscriptionRecord, { transport: 'expo' }>,
  payload: PushPayload,
): Promise<DeliveryOutcome> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify([
        { to: record.token, title: payload.entityTitle, body: payload.text, data: payload },
      ]),
    });
    const json = (await res.json()) as {
      data?: Array<{ status: string; details?: { error?: string } }>;
    };
    const ticket = json.data?.[0];
    if (ticket?.status === 'error') {
      if (ticket.details?.error === 'DeviceNotRegistered') return 'gone';
      console.error(
        `paper-camp: Expo push delivery failed for ${record.name}: ${ticket?.details?.error ?? 'unknown error'}`,
      );
      return 'failed';
    }
    return 'delivered';
  } catch (err) {
    console.error(`paper-camp: Expo push delivery failed for ${record.name}:`, err);
    return 'failed';
  }
}

// Best-effort fan-out: a delivery failure is logged here and never re-enters the
// notification log, so it can't itself trigger another push.
export async function sendPushForProject(
  root: string,
  payload: PushPayload,
  options: SendPushOptions = {},
): Promise<void> {
  const storePath = options.storePath ?? defaultPushStorePath();
  const store = await loadPushStore(storePath);
  const records = subscriptionsForProject(store, root);
  if (records.length === 0) return;

  const vapid = await loadOrMintVapidKeys(options.vapidKeysPath ?? defaultVapidKeysPath());
  const outcomes = await Promise.all(
    records.map(async (record) => ({
      record,
      outcome:
        record.transport === 'webpush'
          ? await sendWebPush(record, payload, vapid)
          : await sendExpoPush(record, payload),
    })),
  );

  const gone = outcomes.filter((o) => o.outcome === 'gone').map((o) => o.record);
  const delivered = outcomes.filter((o) => o.outcome === 'delivered').map((o) => o.record);
  if (gone.length === 0 && delivered.length === 0) return;

  const deliveredAt = new Date().toISOString();
  await withPushStoreLock(async () => {
    let current = await loadPushStore(storePath);
    for (const record of gone) {
      current = removeSubscription(current, root, record.transport, subscriptionKey(record)).store;
    }
    current = {
      ...current,
      subscriptions: current.subscriptions.map((s) =>
        delivered.some(
          (d) => subscriptionKey(d) === subscriptionKey(s) && d.transport === s.transport,
        )
          ? { ...s, lastDeliveryAt: deliveredAt }
          : s,
      ),
    };
    await savePushStore(storePath, current);
  });
}
