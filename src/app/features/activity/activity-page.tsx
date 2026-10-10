import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { Card, EmptyState, PageTitle, Spinner } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useActivityPage } from './hooks';
import {
  ActivityComposer,
  ActivityStatsLine,
  ActivityStream,
  ActivityTitleActions,
  ActivityToolbar,
  ClearChatModal,
} from './views';

export const ActivityPage = () => {
  const {
    loading,
    entries,
    hasMore,
    loadMore,
    hasAnyRows,
    hasMatches,
    filters,
    setFilters,
    availableTypes,
    totalCount,
    matchedCount,
    runningRows,
    unreadCount,
    markAllRead,
    hasActiveFilters,
    clearFilters,
    stats,
    activityKind,
    setActivityKind,
    chat,
  } = useActivityPage();

  return (
    <div>
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="shrink-0">Activity</PageTitle>
        <div className="flex-1" />
        {(hasAnyRows || chat.thread.length > 0) && (
          <ActivityTitleActions
            runningRows={runningRows}
            unreadCount={unreadCount}
            unreadFilterOn={filters.unread}
            onToggleUnread={() => setFilters({ unread: !filters.unread })}
            onMarkAllRead={markAllRead}
            matchedCount={matchedCount}
            totalCount={totalCount}
            unansweredCount={chat.unansweredCount}
            hasChatHistory={chat.thread.length > 0}
            onClearChat={chat.openConfirmClear}
          />
        )}
      </div>

      <ActivityToolbar
        filters={filters}
        availableTypes={availableTypes}
        onFiltersChange={setFilters}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        activityKind={activityKind}
        onActivityKindChange={setActivityKind}
      />
      <ActivityStatsLine stats={stats} />

      {chat.loading && chat.thread.length === 0 ? (
        <RowSkeleton />
      ) : (
        <ActivityComposer
          input={chat.input}
          setInput={chat.setInput}
          sending={chat.sending}
          onSend={chat.handleSend}
        />
      )}

      {chat.pending && (
        <div className="flex flex-col gap-1 items-end mb-3">
          <div className="max-w-[85%]">
            <Card size="small" surface="paper" texture="parchment" accent accentColor="blue">
              {chat.pending}
            </Card>
          </div>
        </div>
      )}
      {chat.sending && (
        <div className="flex flex-col gap-1 items-start mb-3">
          <Card size="small" texture={surface.nestedCard}>
            <Spinner size="small" label="Agent thinking…" />
          </Card>
        </div>
      )}

      {loading && !hasAnyRows && <RowSkeleton />}
      {!loading && !hasAnyRows && (
        <EmptyState
          illustration={<DoodleIllustration name="resting-pen" />}
          message="Nothing recorded yet."
        />
      )}
      {hasAnyRows &&
        (hasMatches ? (
          <ActivityStream
            entries={entries}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onAnswer={chat.handleAnswer}
            answering={chat.sending}
          />
        ) : (
          <p className="opacity-50">No entries match these filters.</p>
        ))}

      <ClearChatModal
        open={chat.confirmOpen}
        onClose={chat.closeConfirmClear}
        onConfirm={chat.handleClear}
        confirming={chat.clearing}
      />
    </div>
  );
};
