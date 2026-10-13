import { SidebarAction } from '@/app/components';
import type { LogRow } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { StopRunButton } from './run-row-detail';

export interface ActivityTitleActionsProps {
  runningRows: LogRow[];
  unreadCount: number;
  unreadFilterOn: boolean;
  onToggleUnread: () => void;
  onMarkAllRead: () => Promise<void>;
}

export const ActivityTitleActions = ({
  runningRows,
  unreadCount,
  unreadFilterOn,
  onToggleUnread,
  onMarkAllRead,
}: ActivityTitleActionsProps) => {
  const navigate = useNavigate();
  const running = runningRows[0];

  return (
    <div className="flex shrink-0 items-center gap-2">
      {running && (
        <Stamp
          size="small"
          variant="info"
          dot
          onClick={() => navigate({ to: '/activity/$entryId', params: { entryId: running.id } })}
          ariaLabel={`Open the running task ${running.entityId ?? running.title}`}
        >
          {runningRows.length} running{running.entityId ? ` · ${running.entityId}` : ''}
        </Stamp>
      )}
      {running?.source.kind === 'running' && running.source.task.status !== 'stopping' && (
        <StopRunButton taskId={running.source.task.id} />
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
          <SidebarAction onClick={() => void onMarkAllRead()}>Mark all read</SidebarAction>
        </>
      )}
    </div>
  );
};
