import type { Notification, StoredNotification } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { newlyArrived, pushableNotifications } from './notification-push';

const question = (): Notification => ({
  entityId: 'IDEA-1',
  entityTitle: 'A question',
  text: 'Need a decision',
  ageDays: 1,
  kind: 'question',
});

const stored = (overrides: Partial<StoredNotification> = {}): StoredNotification => ({
  id: 'notif-1',
  kind: 'completed',
  entityId: 'IDEA-2',
  entityTitle: 'A run',
  text: 'run-all finished',
  date: '2026-08-12T00:00:00.000Z',
  read: false,
  ...overrides,
});

describe('pushableNotifications', () => {
  it('drops parked questions and keeps completed/reply kinds', () => {
    const result = pushableNotifications([question(), stored({ kind: 'reply' })]);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('reply');
  });
});

describe('newlyArrived', () => {
  it('reports nothing on the first snapshot (seen is null)', () => {
    expect(newlyArrived([stored()], null)).toEqual([]);
  });

  it('reports entries whose id was not in the prior seen set', () => {
    const older = stored({ id: 'notif-1' });
    const newer = stored({ id: 'notif-2' });
    const result = newlyArrived([older, newer], new Set(['notif-1']));
    expect(result.map((n) => n.id)).toEqual(['notif-2']);
  });

  it('reports nothing once every current id was already seen', () => {
    const n = stored({ id: 'notif-1' });
    expect(newlyArrived([n], new Set(['notif-1']))).toEqual([]);
  });
});
