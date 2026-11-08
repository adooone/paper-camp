import type { Notification, ThreadMessage, WorklistEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { openIdeasCount, unansweredChatCount, unreadActivityCount } from './scope-counts';

const entry = (status: WorklistEntry['status']) => ({ status }) as WorklistEntry;

describe('scope counts', () => {
  it('counts only open entries of a cached worklist', () => {
    expect(openIdeasCount([entry('open'), entry('done'), entry('open')])).toBe(2);
  });

  it('is null while the source has not arrived', () => {
    expect(openIdeasCount(undefined)).toBeNull();
    expect(unreadActivityCount(null)).toBeNull();
    expect(unansweredChatCount(undefined)).toBeNull();
  });

  it('counts unread notifications and every question', () => {
    const notifications = [
      { kind: 'question', read: true },
      { kind: 'pr-review-changes-requested', read: false },
      { kind: 'pr-review-changes-requested', read: true },
    ] as unknown as Notification[];
    expect(unreadActivityCount(notifications)).toBe(2);
  });

  it('counts no unanswered chat questions in an empty thread', () => {
    expect(unansweredChatCount([] as ThreadMessage[])).toBe(0);
  });
});
