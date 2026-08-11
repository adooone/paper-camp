import { appendFile, writeFile } from 'node:fs/promises';
import { parseNotificationLog } from '@/core/parse';
import type { StoredNotification, StoredNotificationKind } from '@/types/index';
import { campFile, readMaybe } from './helpers';

// Serialized like tasks.log: an append racing a mark-read read-modify-write
// would drop whichever wrote last.
let notificationChain: Promise<unknown> = Promise.resolve();

interface NewNotification {
  id: string;
  kind: StoredNotificationKind;
  entityId: string;
  entityTitle: string;
  text: string;
  outcome?: 'done' | 'error';
}

const notificationLogPath = (root: string) => campFile(root, 'notifications.log');

// Best-effort: a log write failure must never take down the event that triggered it.
export function appendNotification(root: string, notification: NewNotification): Promise<void> {
  const run = notificationChain.then(async () => {
    const entry: StoredNotification = {
      ...notification,
      date: new Date().toISOString(),
      read: false,
    };
    await appendFile(notificationLogPath(root), `${JSON.stringify(entry)}\n`, 'utf-8').catch(
      (err) => {
        console.error(`papercamp: could not append notification ${notification.id}:`, err);
      },
    );
  });
  notificationChain = run.catch(() => undefined);
  return run;
}

export async function readNotifications(root: string): Promise<StoredNotification[]> {
  return parseNotificationLog(await readMaybe(notificationLogPath(root)));
}

export function markNotificationRead(root: string, id: string): Promise<void> {
  const run = notificationChain.then(async () => {
    const path = notificationLogPath(root);
    const entries = parseNotificationLog(await readMaybe(path));
    const next = entries.map((e) => (e.id === id ? { ...e, read: true } : e));
    await writeFile(path, next.map((e) => `${JSON.stringify(e)}\n`).join(''), 'utf-8').catch(
      (err) => {
        console.error(`papercamp: could not mark notification ${id} read:`, err);
      },
    );
  });
  notificationChain = run.catch(() => undefined);
  return run;
}
