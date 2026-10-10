import { FeedbackThread } from '@/app/features/plans/components';
import type { ActivityEntry } from '@/core/activity-entries';
import { Button } from '@dendelion/paper-ui';
import { LogRowView } from './run-row';

export interface ActivityStreamProps {
  entries: ActivityEntry[];
  hasMore: boolean;
  onLoadMore: () => void;
  onAnswer: (text: string) => Promise<boolean>;
  answering: boolean;
}

export const ActivityStream = ({
  entries,
  hasMore,
  onLoadMore,
  onAnswer,
  answering,
}: ActivityStreamProps) => (
  <div className="flex flex-col gap-1">
    {entries.map((entry) =>
      entry.entryKind === 'run' ? (
        <LogRowView key={entry.row.id} row={entry.row} />
      ) : (
        <div key={`chat-${entry.index}`} className="py-1">
          <FeedbackThread
            messages={[entry.message]}
            undo={null}
            undoing={false}
            onUndo={() => {}}
            onAnswer={onAnswer}
            answering={answering}
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
