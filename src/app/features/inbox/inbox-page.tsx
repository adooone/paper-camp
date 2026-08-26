import { PageTitle } from '@/app/components/page-title';
import { PlanIdStamp } from '@/app/features/plans/components';
import { notificationAgeDays } from '@/core/notifications';
import { formatAge } from './helpers';
import { useInboxPage } from './hooks';
import { NotificationRow } from './notification-row';
import { QuestionRow } from './question-row';

export const InboxPage = () => {
  const { notifications, loadFailed, plans, expandedKey, setExpandedKey, openEntity, reload } =
    useInboxPage();

  return (
    <div>
      <PageTitle>Inbox</PageTitle>
      <p className="opacity-50 mb-6">
        Every parked question, completed run, and agent reply, oldest first.
      </p>
      {loadFailed && <p className="opacity-50">Couldn't load notifications.</p>}
      {!loadFailed && !notifications && <p className="opacity-50">Loading…</p>}
      {notifications && notifications.length === 0 && (
        <p className="opacity-50">Nothing here — no parked questions or recent activity.</p>
      )}
      {notifications && notifications.length > 0 && (
        <div className="flex flex-col">
          {notifications.map((n, i) => {
            const key = `${n.entityId}-${n.kind}-${i}`;
            const onOpen = () => openEntity(n.entityId, n.entityTitle);

            if (n.kind !== 'question') {
              return (
                <NotificationRow
                  key={key}
                  notification={n}
                  ageDays={notificationAgeDays(n)}
                  onOpen={onOpen}
                />
              );
            }

            const plan = plans?.entries.find((p) => p.id === n.entityId);
            if (!plan) {
              return (
                <div
                  key={key}
                  className="flex items-center gap-3 py-2.5 border-b border-black/10 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={onOpen}
                    aria-label={`Open ${n.entityTitle}`}
                    className="bg-transparent border-none p-0 cursor-pointer"
                  >
                    <PlanIdStamp id={n.entityId} />
                  </button>
                  <span className="flex-1 min-w-0 truncate">{n.text}</span>
                  <span className="opacity-50 text-xs whitespace-nowrap">
                    {formatAge(n.ageDays)}
                  </span>
                </div>
              );
            }
            return (
              <QuestionRow
                key={key}
                question={n}
                plan={plan}
                expanded={expandedKey === key}
                onToggle={() => setExpandedKey((cur) => (cur === key ? null : key))}
                onOpen={onOpen}
                reload={reload}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
