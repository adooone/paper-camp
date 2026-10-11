import type { ScopeRow } from '@/app/features/scope';
import { Button } from '@dendelion/paper-ui';
import type { ScopedActivityEntry } from '../helpers';
import { LogRowView } from './run-row';

export interface ActivityStreamProps {
  entries: ScopedActivityEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
}

export const ActivityStream = ({
  entries,
  hasMore,
  onLoadMore,
  onOpenCrossProject,
}: ActivityStreamProps) => (
  <div className="flex flex-col gap-1">
    {entries.map(({ row, project }) => (
      <LogRowView
        key={row.id}
        row={row}
        project={project}
        onOpenCrossProject={onOpenCrossProject}
      />
    ))}
    {hasMore && (
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="small" onClick={onLoadMore}>
          Load more
        </Button>
      </div>
    )}
  </div>
);
