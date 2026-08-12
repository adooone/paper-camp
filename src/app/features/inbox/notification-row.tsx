import { PlanIdStamp } from '@/app/features/plans/components';
import type { StoredNotification } from '@/types/index';
import { formatAge } from './helpers';

const KIND_LABELS: Record<StoredNotification['kind'], string> = {
  completed: 'Completed',
  reply: 'Reply',
};

interface NotificationRowProps {
  notification: StoredNotification;
  ageDays: number;
  onOpen: () => void;
}

export const NotificationRow = ({ notification, ageDays, onOpen }: NotificationRowProps) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-black/10 last:border-b-0">
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${notification.entityTitle}`}
      className="bg-transparent border-none p-0 cursor-pointer"
    >
      <PlanIdStamp id={notification.entityId} />
    </button>
    <span className="text-xs uppercase tracking-wide opacity-40 whitespace-nowrap">
      {KIND_LABELS[notification.kind]}
    </span>
    <span className="flex-1 min-w-0 truncate">{notification.text}</span>
    <span className="opacity-50 text-xs whitespace-nowrap">{formatAge(ageDays)}</span>
  </div>
);
