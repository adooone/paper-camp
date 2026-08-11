import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appendNotification, markNotificationRead, readNotifications } from './notification-log';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-notification-log-'));
  mkdirSync(join(root, 'papercamp'), { recursive: true });
  roots.push(root);
  return root;
}

const notification = (overrides: Partial<Parameters<typeof appendNotification>[1]> = {}) => ({
  id: 'notif-1',
  kind: 'completed' as const,
  entityId: 'IDEA-1',
  entityTitle: 'First',
  text: 'run-all finished',
  ...overrides,
});

describe('appendNotification', () => {
  it('appends a new notification as unread, stamped with the current date', async () => {
    const root = makeRoot();
    await appendNotification(root, notification());

    const [logged] = await readNotifications(root);
    expect(logged).toMatchObject({
      id: 'notif-1',
      kind: 'completed',
      entityId: 'IDEA-1',
      entityTitle: 'First',
      text: 'run-all finished',
      read: false,
    });
    expect(typeof logged.date).toBe('string');
  });

  it('carries the outcome for a completed notification', async () => {
    const root = makeRoot();
    await appendNotification(root, notification({ outcome: 'error' }));

    const [logged] = await readNotifications(root);
    expect(logged.outcome).toBe('error');
  });

  it('omits the outcome for a reply notification', async () => {
    const root = makeRoot();
    await appendNotification(root, notification({ kind: 'reply', outcome: undefined }));

    const [logged] = await readNotifications(root);
    expect(logged.outcome).toBeUndefined();
  });

  it('keeps appending rows across multiple notifications', async () => {
    const root = makeRoot();
    await appendNotification(root, notification({ id: 'notif-1' }));
    await appendNotification(root, notification({ id: 'notif-2', kind: 'reply' }));

    const logged = await readNotifications(root);
    expect(logged.map((n) => n.id)).toEqual(['notif-1', 'notif-2']);
  });
});

describe('readNotifications', () => {
  it('returns an empty list when no notifications.log exists yet', async () => {
    const root = makeRoot();
    expect(await readNotifications(root)).toEqual([]);
  });
});

describe('markNotificationRead', () => {
  it('flips only the matching notification to read', async () => {
    const root = makeRoot();
    await appendNotification(root, notification({ id: 'notif-1' }));
    await appendNotification(root, notification({ id: 'notif-2', kind: 'reply' }));

    await markNotificationRead(root, 'notif-1');

    const logged = await readNotifications(root);
    expect(logged.find((n) => n.id === 'notif-1')?.read).toBe(true);
    expect(logged.find((n) => n.id === 'notif-2')?.read).toBe(false);
  });

  it('rewrites the log with a matching row count when the id is unknown', async () => {
    const root = makeRoot();
    await appendNotification(root, notification({ id: 'notif-1' }));

    await markNotificationRead(root, 'does-not-exist');

    const raw = readFileSync(join(root, 'papercamp', 'notifications.log'), 'utf-8');
    expect(raw.trim().split('\n')).toHaveLength(1);
  });
});
