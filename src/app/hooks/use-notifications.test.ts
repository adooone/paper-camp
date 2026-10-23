import { notificationsQueryKey, queryClient } from '@/app/services/query-client';
import { getRuntimeConnection } from '@/app/services/runtime-connection';
import type { Notification } from '@/types/index';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markRead } from './use-notifications';

describe('markRead', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    queryClient.clear();
  });

  it('rolls back the optimistic update and rethrows on a failed POST', async () => {
    const key = notificationsQueryKey(getRuntimeConnection().runtimeUrl);
    const previous: Notification[] = [
      {
        id: 'n1',
        kind: 'completed',
        entityId: 'IDEA-1',
        entityTitle: 'Example',
        text: 'Done',
        date: '2026-10-23T00:00:00.000Z',
        read: false,
        push: false,
      },
    ];
    queryClient.setQueryData(key, previous);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await expect(markRead('n1')).rejects.toThrow();

    expect(queryClient.getQueryData(key)).toEqual(previous);
  });
});
