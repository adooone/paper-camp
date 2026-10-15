import { SidebarAction } from '@/app/components';
import { Stamp } from '@dendelion/folk-ui';

export interface ActivityTitleActionsProps {
  unreadCount: number;
  unreadFilterOn: boolean;
  onToggleUnread: () => void;
  onMarkAllRead: () => Promise<void>;
}

export const ActivityTitleActions = ({
  unreadCount,
  unreadFilterOn,
  onToggleUnread,
  onMarkAllRead,
}: ActivityTitleActionsProps) => {
  return (
    <div className="flex shrink-0 items-center gap-2">
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
