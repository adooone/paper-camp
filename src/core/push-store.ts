import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { machineConfigDir } from './machine-registry';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export type PushSubscriptionRecord =
  | {
      transport: 'webpush';
      root: string;
      name: string;
      subscription: WebPushSubscription;
      lastDeliveryAt?: string;
    }
  | {
      transport: 'expo';
      root: string;
      name: string;
      token: string;
      lastDeliveryAt?: string;
    };

export interface PushStore {
  version: 1;
  subscriptions: PushSubscriptionRecord[];
}

const EMPTY_STORE: PushStore = { version: 1, subscriptions: [] };

export function defaultPushStorePath(): string {
  return join(machineConfigDir(), 'push.json');
}

export function subscriptionKey(record: PushSubscriptionRecord): string {
  return record.transport === 'webpush' ? record.subscription.endpoint : record.token;
}

function isWebPushSubscription(value: unknown): value is WebPushSubscription {
  const v = value as Partial<WebPushSubscription> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.endpoint === 'string' &&
    typeof v.keys === 'object' &&
    v.keys !== null &&
    typeof v.keys.p256dh === 'string' &&
    typeof v.keys.auth === 'string'
  );
}

function isPushSubscriptionRecord(value: unknown): value is PushSubscriptionRecord {
  const v = value as Partial<PushSubscriptionRecord> | null;
  if (typeof v !== 'object' || v === null) return false;
  if (typeof v.root !== 'string' || typeof v.name !== 'string') return false;
  if (v.lastDeliveryAt !== undefined && typeof v.lastDeliveryAt !== 'string') return false;
  if (v.transport === 'webpush') return isWebPushSubscription(v.subscription);
  if (v.transport === 'expo') return typeof v.token === 'string';
  return false;
}

function isPushStore(value: unknown): value is PushStore {
  const v = value as Partial<PushStore> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    v.version === 1 &&
    Array.isArray(v.subscriptions) &&
    v.subscriptions.every(isPushSubscriptionRecord)
  );
}

export async function loadPushStore(path: string): Promise<PushStore> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('paper-camp: could not read push subscriptions:', error);
    }
    return EMPTY_STORE;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPushStore(parsed) ? parsed : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

export async function savePushStore(path: string, store: PushStore): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(store, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  await rename(tmpPath, path);
}

export function subscriptionsForProject(store: PushStore, root: string): PushSubscriptionRecord[] {
  return store.subscriptions.filter((s) => s.root === root);
}

export function upsertSubscription(store: PushStore, record: PushSubscriptionRecord): PushStore {
  const key = subscriptionKey(record);
  const subscriptions = store.subscriptions.filter(
    (s) =>
      !(s.root === record.root && s.transport === record.transport && subscriptionKey(s) === key),
  );
  return { ...store, subscriptions: [...subscriptions, record] };
}

export interface RemoveSubscriptionResult {
  store: PushStore;
  removed: boolean;
}

export function removeSubscription(
  store: PushStore,
  root: string,
  transport: PushSubscriptionRecord['transport'],
  key: string,
): RemoveSubscriptionResult {
  const subscriptions = store.subscriptions.filter(
    (s) => !(s.root === root && s.transport === transport && subscriptionKey(s) === key),
  );
  return {
    store: { ...store, subscriptions },
    removed: subscriptions.length !== store.subscriptions.length,
  };
}

let pushStoreChain: Promise<unknown> = Promise.resolve();

export function withPushStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = pushStoreChain.then(fn, fn);
  pushStoreChain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
