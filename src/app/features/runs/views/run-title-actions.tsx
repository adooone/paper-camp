import type { LogRow } from '@/types/index';
import { Button, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

export interface LogTitleActionsProps {
  runningRows: LogRow[];
  unreadCount: number;
  unreadFilterOn: boolean;
  onToggleUnread: () => void;
  onMarkAllRead: () => Promise<void>;
  matchedCount: number;
  totalCount: number;
}

const countClass = 'font-handwritten text-sm opacity-[0.55] whitespace-nowrap';

export const LogTitleActions = ({
  runningRows,
  unreadCount,
  unreadFilterOn,
  onToggleUnread,
  onMarkAllRead,
  matchedCount,
  totalCount,
}: LogTitleActionsProps) => {
  const navigate = useNavigate();
  const running = runningRows[0];
  const hasActiveFilters = matchedCount !== totalCount;

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {running && (
        <Stamp
          size="small"
          variant="info"
          dot
          onClick={() => navigate({ to: '/log/$entryId', params: { entryId: running.id } })}
          ariaLabel={`Open the running task ${running.entityId ?? running.title}`}
        >
          {runningRows.length} running{running.entityId ? ` · ${running.entityId}` : ''}
        </Stamp>
      )}
      {unreadCount > 0 && (
        <>
          <Stamp
            size="small"
            variant={unreadFilterOn ? 'info' : 'warning'}
            onClick={onToggleUnread}
            pressed={unreadFilterOn}
            ariaLabel={`${unreadCount} unread — ${unreadFilterOn ? 'show all' : 'show only unread'}`}
          >
            {unreadCount} unread
          </Stamp>
          <Button variant="link" size="small" onClick={() => void onMarkAllRead()}>
            Mark all read
          </Button>
        </>
      )}
      <span className={countClass}>
        {hasActiveFilters ? `${matchedCount} of ${totalCount} entries` : `${totalCount} entries`}
      </span>
    </div>
  );
};
