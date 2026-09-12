import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { isNotificationKindEnabled, notificationSettingKind } from '@/core/notifications';
import { parseNotificationLog } from '@/core/parse';
import { sendPushForProject } from '@/core/push-send';
import type { PaperCampConfig, StoredNotification, StoredNotificationKind } from '@/types/index';
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
  outcome?: 'done' | 'error' | 'interrupted';
}

const notificationLogPath = (root: string) => campFile(root, 'notifications.log');

async function resolvePush(root: string, notification: NewNotification): Promise<boolean> {
  const raw = await readMaybe(campFile(root, 'config.json'));
  const config = raw ? (JSON.parse(raw) as PaperCampConfig) : undefined;
  const settingKind = notificationSettingKind(notification.kind, notification.outcome);
  return isNotificationKindEnabled(config?.notifications?.kinds, settingKind);
}

// Best-effort: a log write failure must never take down the event that triggered it.
export function appendNotification(root: string, notification: NewNotification): Promise<void> {
  const run = notificationChain.then(async () => {
    const entry: StoredNotification = {
      ...notification,
      date: new Date().toISOString(),
      read: false,
      push: await resolvePush(root, notification),
    };
    const path = notificationLogPath(root);
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf-8');
    } catch (err) {
      console.error(`papercamp: could not append notification ${notification.id}:`, err);
    }
    if (entry.push) {
      void sendPushForProject(root, {
        id: entry.id,
        entityId: entry.entityId,
        entityTitle: entry.entityTitle,
        text: entry.text,
      }).catch((err) => {
        console.error(`papercamp: could not send push for notification ${notification.id}:`, err);
      });
    }
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
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, next.map((e) => `${JSON.stringify(e)}\n`).join(''), 'utf-8');
    } catch (err) {
      console.error(`papercamp: could not mark notification ${id} read:`, err);
      throw err;
    }
  });
  notificationChain = run.catch(() => undefined);
  return run;
}
