import type { WorklistEntry } from '@/types/index';
import { progressOf, STATUS_LABEL, STATUS_MEANING, statusOf } from '../shell/ideas-model';
import { Button } from '../ui/button';
import { EmptyState } from '../ui/empty-state';
import { Hand } from '../ui/hand';
import { SkeletonRows } from '../ui/skeleton-rows';
import { Stamp } from '../ui/stamp';
import styles from './idea-column.module.css';

interface IdeaColumnProps {
  ideaId: string | undefined;
  entries: WorklistEntry[];
  loading: boolean;
  onBack?: () => void;
}

export function IdeaColumn({ ideaId, entries, loading, onBack }: IdeaColumnProps) {
  if (!ideaId) {
    return <EmptyState title="Pick an idea" line="Its plan, phases and thread open here." />;
  }
  const entry = entries.find((candidate) => candidate.id === ideaId);
  if (!entry) {
    return loading ? (
      <SkeletonRows />
    ) : (
      <EmptyState
        title="No such idea"
        line={`${ideaId} is not on this project.`}
        actionLabel={onBack ? 'Back to ideas' : undefined}
        onAction={onBack}
      />
    );
  }
  const status = statusOf(entry);
  const progress = progressOf(entry);
  return (
    <article className={styles.column}>
      {onBack ? <Button label="‹ Ideas" variant="ghost" size="sm" onPress={onBack} /> : null}
      <div className={styles.head}>
        <Hand size="xs" color="inkFaint">
          {entry.id}
        </Hand>
        <Hand as="h2" font="display" size="xl">
          {entry.title}
        </Hand>
        <div className={styles.meta}>
          <Stamp meaning={STATUS_MEANING[status]}>{STATUS_LABEL[status]}</Stamp>
          {progress ? (
            <Hand size="sm" color="inkSoft">
              {progress}
            </Hand>
          ) : null}
        </div>
      </div>
    </article>
  );
}
