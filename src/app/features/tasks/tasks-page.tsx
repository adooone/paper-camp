import { EmptyState } from '@/app/components';
import { RestingPenIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { useTasksPage } from './hooks';
import { TaskList } from './views';

export const TasksPage = () => {
  const { taskLogLoading, groups, taskId, containerRef } = useTasksPage();

  return (
    <div ref={containerRef}>
      <PageTitle>Tasks</PageTitle>
      {taskLogLoading && <p className="opacity-50">Loading…</p>}
      {!taskLogLoading && groups.length === 0 && (
        <EmptyState illustration={<RestingPenIllustration />} message="No tasks have run yet." />
      )}
      {!taskLogLoading && groups.length > 0 && <TaskList groups={groups} highlightedId={taskId} />}
    </div>
  );
};
