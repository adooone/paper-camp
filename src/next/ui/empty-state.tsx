import { Button } from './button';
import styles from './empty-state.module.css';
import { Hand } from './hand';

interface EmptyStateProps {
  title: string;
  line: string;
  actionLabel?: string;
  onAction?: () => void;
}

// folk-ui's EmptyState is one muted message; the phone's has a display title, a line and an action.
export function EmptyState({ title, line, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <Hand size="lg" font="display">
        {title}
      </Hand>
      <Hand size="base" color="inkSoft">
        {line}
      </Hand>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} className={styles.action} />
      ) : null}
    </div>
  );
}
