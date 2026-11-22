import { Card } from '@dendelion/folk-ui';
import { useMemo } from 'react';
import { useTaskOutput } from '@/app/features/activity/hooks/use-task-output';
import { Hand } from '../ui/hand';
import styles from './runs.module.css';

interface OutputBoardProps {
  taskId: string;
  live: boolean;
}

export function OutputBoard({ taskId, live }: OutputBoardProps) {
  const { lines } = useTaskOutput(taskId, live);
  const keyed = useMemo(
    () => (lines ?? []).map((line, index) => ({ line, key: `${index}-${line.length}` })),
    [lines],
  );
  return (
    <Card surface="chalkboard">
      <div className={styles.board}>
        {keyed.length === 0 ? (
          <Hand size="base" className={styles.boardEmpty}>
            No output yet.
          </Hand>
        ) : (
          keyed.map(({ line, key }) => (
            <span key={key} className={styles.boardLine}>
              {line}
            </span>
          ))
        )}
      </div>
    </Card>
  );
}
