import { EmptyState, RowSkeleton } from '@/app/components';
import { MagnifierIllustration } from '@/app/components/empty-state-illustrations';
import type { LogRow } from '@/types/index';
import { Button } from '@dendelion/paper-ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useLogEntryPage } from './hooks';
import type { LogRowActions } from './hooks/use-run-rows';
import { useTaskOutput } from './hooks/use-task-output';
import { EntryDetailsCard, LogOutputPane } from './views';

const pageClass = 'flex flex-col gap-2';

const TaskEntry = ({
  row,
  taskId,
  actions,
}: {
  row: LogRow;
  taskId: string;
  actions: LogRowActions;
}) => {
  const { lines, failed, retry } = useTaskOutput(taskId);
  return (
    <div className={pageClass}>
      <EntryDetailsCard row={row} actions={actions} lines={lines} />
      <LogOutputPane lines={lines} failed={failed} onRetry={retry} />
    </div>
  );
};

const EntryView = ({ row, actions }: { row: LogRow; actions: LogRowActions }) => {
  const { source } = row;
  if (source.kind === 'task')
    return <TaskEntry row={row} taskId={source.entry.id} actions={actions} />;

  const output =
    source.kind === 'running'
      ? source.task.lines
      : source.kind === 'issue' && source.issue.output
        ? source.issue.output.split('\n')
        : null;

  if (!output) return <EntryDetailsCard row={row} actions={actions} lines={null} />;
  return (
    <div className={pageClass}>
      <EntryDetailsCard row={row} actions={actions} lines={output} />
      <LogOutputPane lines={output} failed={false} />
    </div>
  );
};

export const LogEntryPage = () => {
  const { entryId } = useParams({ from: '/log/$entryId' });
  const { loading, row, actions } = useLogEntryPage(entryId);
  const navigate = useNavigate();

  if (!row) {
    if (loading) return <RowSkeleton />;
    return (
      <EmptyState
        illustration={<MagnifierIllustration />}
        message="This entry doesn't exist."
        action={
          <Button size="small" onClick={() => navigate({ to: '/log' })}>
            Back to Log
          </Button>
        }
      />
    );
  }

  return <EntryView row={row} actions={actions} />;
};
