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
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

const stampTriggerClass = 'cursor-pointer border-none bg-transparent p-0';
const countClass = 'font-handwritten text-sm opacity-[0.55] whitespace-nowrap';

export const LogTitleActions = ({
  runningRows,
  unreadCount,
  unreadFilterOn,
  onToggleUnread,
  onMarkAllRead,
  matchedCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
}: LogTitleActionsProps) => {
  const navigate = useNavigate();
  const running = runningRows[0];

  return (
    <div className="flex flex-wrap items-center gap-3">
      {running && (
        // paper-ui has no clickable Stamp, so a raw button wraps it (see docs/CODE_STYLE.md §1)
        <button
          type="button"
          className={stampTriggerClass}
          onClick={() => navigate({ to: '/log/$entryId', params: { entryId: running.id } })}
          aria-label={`Open the running task ${running.entityId ?? running.title}`}
        >
          <Stamp size="small" variant="info" dot>
            {runningRows.length} running{running.entityId ? ` · ${running.entityId}` : ''}
          </Stamp>
        </button>
      )}
      {unreadCount > 0 && (
        <>
          <button
            type="button"
            className={stampTriggerClass}
            onClick={onToggleUnread}
            aria-pressed={unreadFilterOn}
            aria-label={`${unreadCount} unread — ${unreadFilterOn ? 'show all' : 'show only unread'}`}
          >
            <Stamp size="small" variant={unreadFilterOn ? 'info' : 'warning'}>
              {unreadCount} unread
            </Stamp>
          </button>
          <Button variant="ghost" size="small" onClick={() => void onMarkAllRead()}>
            Mark all read
          </Button>
        </>
      )}
      <span className={countClass}>
        {hasActiveFilters ? `${matchedCount} of ${totalCount} entries` : `${totalCount} entries`}
      </span>
      {hasActiveFilters && (
        <Button variant="ghost" size="small" onClick={onClearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
};
