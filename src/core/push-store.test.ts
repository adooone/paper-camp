import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  type PushSubscriptionRecord,
  loadPushStore,
  removeSubscription,
  savePushStore,
  subscriptionsForProject,
  upsertSubscription,
} from './push-store';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-push-store-'));
  dirs.push(dir);
  return dir;
}

type WebPushRecord = Extract<PushSubscriptionRecord, { transport: 'webpush' }>;

const webPush = (overrides: Partial<WebPushRecord> = {}): WebPushRecord => ({
  transport: 'webpush',
  root: '/repo/a',
  name: 'Chrome on laptop',
  subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
  ...overrides,
});

describe('loadPushStore', () => {
  it('resolves the empty store when the file does not exist', async () => {
    const dir = await makeTempDir();
    expect(await loadPushStore(join(dir, 'push.json'))).toEqual({ version: 1, subscriptions: [] });
  });

  it('resolves the empty store for malformed JSON', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'push.json');
    await writeFile(path, 'not json', 'utf-8');
    expect(await loadPushStore(path)).toEqual({ version: 1, subscriptions: [] });
  });

  it('round-trips through savePushStore', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'push.json');
    const store = { version: 1 as const, subscriptions: [webPush()] };
    await savePushStore(path, store);
    expect(await loadPushStore(path)).toEqual(store);
  });
});

describe('upsertSubscription', () => {
  it('adds a new subscription', () => {
    const result = upsertSubscription({ version: 1, subscriptions: [] }, webPush());
    expect(result.subscriptions).toHaveLength(1);
  });

  it('replaces an existing subscription with the same root, transport, and endpoint', () => {
    const original = webPush({ name: 'old name' });
    const updated = webPush({ name: 'new name' });
    const result = upsertSubscription({ version: 1, subscriptions: [original] }, updated);
    expect(result.subscriptions).toEqual([updated]);
  });

  it('keeps a subscription for a different project distinct', () => {
    const a = webPush({ root: '/repo/a' });
    const b = webPush({ root: '/repo/b' });
    const result = upsertSubscription({ version: 1, subscriptions: [a] }, b);
    expect(result.subscriptions).toHaveLength(2);
  });
});

describe('removeSubscription', () => {
  it('removes the matching subscription and reports removed: true', () => {
    const record = webPush();
    const result = removeSubscription(
      { version: 1, subscriptions: [record] },
      record.root,
      'webpush',
      'https://push.example/1',
    );
    expect(result.removed).toBe(true);
    expect(result.store.subscriptions).toEqual([]);
  });

  it('reports removed: false when no subscription matches', () => {
    const result = removeSubscription(
      { version: 1, subscriptions: [] },
      '/repo/a',
      'webpush',
      'nope',
    );
    expect(result.removed).toBe(false);
  });
});

describe('subscriptionsForProject', () => {
  it('returns only subscriptions for the given root', () => {
    const a = webPush({ root: '/repo/a' });
    const b = webPush({
      root: '/repo/b',
      subscription: { endpoint: 'e2', keys: { p256dh: 'p', auth: 'a' } },
    });
    const result = subscriptionsForProject({ version: 1, subscriptions: [a, b] }, '/repo/a');
    expect(result).toEqual([a]);
  });
});
