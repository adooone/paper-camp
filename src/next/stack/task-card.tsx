import type { QueueCardView, TaskCardView } from '../shell/stack-model';
import { Button } from '../ui/button';
import { Stamp, type StampMeaning } from '../ui/stamp';
import { ChalkCard } from './chalk';
import styles from './stack.module.css';

interface RunCardProps {
  title: string;
  meta: string;
  stamp: { meaning: StampMeaning; label: string };
  chip?: string;
  onOpen?: () => void;
  stopLabel?: string;
  onStop?: () => void;
  stopDisabled?: boolean;
  onStamp?: () => void;
}

function RunCard({
  title,
  meta,
  stamp,
  chip,
  onOpen,
  stopLabel,
  onStop,
  stopDisabled,
  onStamp,
}: RunCardProps) {
  const badge = <Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>;
  return (
    <ChalkCard chip={chip}>
      <div className={styles.cardRow}>
        {onOpen ? (
          <button type="button" onClick={onOpen} className={styles.open}>
            <span className={styles.title}>{title}</span>
          </button>
        ) : (
          <span className={styles.open}>
            <span className={styles.title}>{title}</span>
          </span>
        )}
        {onStop ? (
          <Button
            label={stopLabel ?? 'Stop'}
            variant="secondary"
            size="xs"
            onPress={onStop}
            disabled={stopDisabled}
          />
        ) : null}
      </div>
      <div className={styles.cardRow}>
        <span className={styles.muted}>{meta}</span>
        {onStamp ? (
          <button type="button" onClick={onStamp} className={styles.stampButton}>
            {badge}
          </button>
        ) : (
          badge
        )}
      </div>
    </ChalkCard>
  );
}

interface TaskCardProps {
  view: TaskCardView;
  chip?: string;
  onOpen: () => void;
  onStop?: () => void;
  onSignIn: () => void;
}

export function TaskCard({ view, chip, onOpen, onStop, onSignIn }: TaskCardProps) {
  return (
    <RunCard
      title={view.title}
      meta={view.meta}
      stamp={view.stamp}
      chip={chip}
      onOpen={onOpen}
      stopLabel="Stop agent"
      onStop={view.live && onStop ? onStop : undefined}
      stopDisabled={view.stopping}
      onStamp={view.signedOut ? onSignIn : undefined}
    />
  );
}

interface NoticeCardProps {
  title: string;
  chip?: string;
  onOpen: () => void;
  onDismiss: () => void;
}

export function NoticeCard({ title, chip, onOpen, onDismiss }: NoticeCardProps) {
  return (
    <RunCard
      title={title}
      meta="Open the run and retry it."
      stamp={{ meaning: 'parked', label: 'A run was interrupted; run again' }}
      chip={chip}
      onOpen={onOpen}
      stopLabel="Dismiss"
      onStop={onDismiss}
    />
  );
}

interface QueueCardProps {
  view: QueueCardView;
  onStop: () => void;
  onDismiss: () => void;
}

export function QueueCard({ view, onStop, onDismiss }: QueueCardProps) {
  return (
    <RunCard
      title={view.title}
      meta={view.line}
      stamp={view.stamp}
      stopLabel={view.canStop ? 'Stop queue' : 'Dismiss'}
      onStop={view.canStop ? onStop : view.canDismiss ? onDismiss : undefined}
    />
  );
}
