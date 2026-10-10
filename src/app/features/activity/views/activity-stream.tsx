import { FeedbackThread } from '@/app/features/plans/components';
import type { ScopeRow } from '@/app/features/scope';
import { Button } from '@dendelion/paper-ui';
import type { ScopedActivityEntry } from '../helpers';
import { LogRowView } from './run-row';

export interface ActivityStreamProps {
  entries: ScopedActivityEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  onAnswer: (text: string, project?: ScopeRow) => Promise<boolean>;
  answering: boolean;
  onOpenCrossProject: (project: ScopeRow, path: string) => void;
}

export const ActivityStream = ({
  entries,
  hasMore,
  onLoadMore,
  onAnswer,
  answering,
  onOpenCrossProject,
}: ActivityStreamProps) => (
  <div className="flex flex-col gap-1">
    {entries.map(({ entry, project }) =>
      entry.entryKind === 'run' ? (
        <LogRowView
          key={entry.row.id}
          row={entry.row}
          project={project}
          onOpenCrossProject={onOpenCrossProject}
        />
      ) : (
        <div key={`chat-${project?.key ?? 'own'}-${entry.index}`} className="py-1">
          <FeedbackThread
            messages={[entry.message]}
            undo={null}
            undoing={false}
            onUndo={() => {}}
            onAnswer={(text) => onAnswer(text, project)}
            answering={answering}
            project={project}
          />
        </div>
      ),
    )}
    {hasMore && (
      <div className="flex justify-center pt-2">
        <Button variant="ghost" size="small" onClick={onLoadMore}>
          Load more
        </Button>
      </div>
    )}
  </div>
);
