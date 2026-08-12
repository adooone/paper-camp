import { describe, expect, it } from 'vitest';
import type { ParkedQuestion, StoredNotification } from '../types/index';
import { mergeNotifications, notificationAgeDays } from './notifications';

const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

const question = (overrides: Partial<ParkedQuestion> = {}): ParkedQuestion => ({
  entityId: 'IDEA-1',
  entityTitle: 'First',
  text: 'Need a decision',
  date: daysAgo(1).slice(0, 10),
  ageDays: 1,
  ...overrides,
});

const stored = (overrides: Partial<StoredNotification> = {}): StoredNotification => ({
  id: 'notif-1',
  kind: 'completed',
  entityId: 'IDEA-2',
  entityTitle: 'Second',
  text: 'run-all finished',
  date: daysAgo(2),
  read: false,
  ...overrides,
});

describe('mergeNotifications', () => {
  it('tags parked questions with kind "question" and leaves stored kinds as-is', () => {
    const result = mergeNotifications([question()], [stored()]);
    expect(result).toHaveLength(2);
    expect(result.find((n) => n.entityId === 'IDEA-1')).toMatchObject({ kind: 'question' });
    expect(result.find((n) => n.entityId === 'IDEA-2')).toMatchObject({ kind: 'completed' });
  });

  it('orders every kind oldest-first by age', () => {
    const older = question({ entityId: 'IDEA-1', text: 'older', ageDays: 10 });
    const newer = stored({ entityId: 'IDEA-2', text: 'newer', date: daysAgo(1) });
    const result = mergeNotifications([older], [newer]);
    expect(result.map((n) => n.text)).toEqual(['older', 'newer']);
  });

  it('interleaves stored notifications between parked questions by age', () => {
    const oldest = question({ entityId: 'IDEA-1', text: 'oldest', ageDays: 10 });
    const middle = stored({ entityId: 'IDEA-2', text: 'middle', date: daysAgo(5) });
    const newest = question({ entityId: 'IDEA-3', text: 'newest', ageDays: 0 });
    const result = mergeNotifications([oldest, newest], [middle]);
    expect(result.map((n) => n.text)).toEqual(['oldest', 'middle', 'newest']);
  });

  it('returns an empty feed when nothing is parked or stored', () => {
    expect(mergeNotifications([], [])).toEqual([]);
  });
});

describe('notificationAgeDays', () => {
  it('reads ageDays directly off a parked question', () => {
    expect(notificationAgeDays({ ...question(), ageDays: 7, kind: 'question' })).toBe(7);
  });

  it('computes age from date for a stored notification', () => {
    expect(notificationAgeDays({ ...stored(), date: daysAgo(3) })).toBe(3);
  });
});
