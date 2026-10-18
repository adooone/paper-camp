import { RowSkeleton } from '@/app/components';
import type { LogRow } from '@/types/index';
import { Button, EmptyState } from '@dendelion/folk-ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useActivityEntryPage } from './hooks';
import type { LogRowActions } from './hooks/use-run-rows';
import { useTaskOutput } from './hooks/use-task-output';
import { EntryDetailsCard, LogOutputPane } from './views';

export const pageClass = 'flex h-[calc(100dvh-var(--pc-header-h)-32px)] flex-col gap-2';

const TaskEntry = ({
  row,
  taskId,
  actions,
  live = false,
}: {
  row: LogRow;
  taskId: string;
  actions: LogRowActions;
  live?: boolean;
}) => {
  const { lines, failed, retry } = useTaskOutput(taskId, live);
  return (
    <div className={pageClass}>
      <EntryDetailsCard row={row} actions={actions} lines={lines} />
      <LogOutputPane lines={lines} failed={failed} onRetry={retry} live={live} />
    </div>
  );
};

const EntryView = ({ row, actions }: { row: LogRow; actions: LogRowActions }) => {
  const { source } = row;
  if (source.kind === 'task')
    return <TaskEntry row={row} taskId={source.entry.id} actions={actions} />;
  if (source.kind === 'running')
    return <TaskEntry row={row} taskId={source.task.id} actions={actions} live />;

  const output =
    source.kind === 'issue' && source.issue.output ? source.issue.output.split('\n') : null;

  if (!output) return <EntryDetailsCard row={row} actions={actions} lines={null} />;
  return (
    <div className={pageClass}>
      <EntryDetailsCard row={row} actions={actions} lines={output} />
      <LogOutputPane lines={output} failed={false} />
    </div>
  );
};

export const ActivityEntryPage = () => {
  const { entryId } = useParams({ from: '/activity/$entryId' });
  const { loading, row, actions } = useActivityEntryPage(entryId);
  const navigate = useNavigate();

  if (!row) {
    if (loading) return <RowSkeleton />;
    return (
      <EmptyState
        message="This entry doesn't exist."
        action={
          <Button size="small" onClick={() => navigate({ to: '/activity' })}>
            Back to Activity
          </Button>
        }
      />
    );
  }

  return <EntryView row={row} actions={actions} />;
};
