import type { AgentTaskState } from '@/types/index';
import { runLabel } from '../shell/idea-model';
import { Button } from '../ui/button';
import styles from './idea.module.css';

interface ActionBarProps {
  phaseCount: number;
  phasesDone: boolean;
  placeholder: boolean;
  running: AgentTaskState | null;
  walk: { index: number } | null;
  busy: string | null;
  onDraft: () => void;
  onRunNext: () => void;
  onRunAll: () => void;
  onStop: () => void;
}

export function ActionBar({
  phaseCount,
  phasesDone,
  placeholder,
  running,
  walk,
  busy,
  onDraft,
  onRunNext,
  onRunAll,
  onStop,
}: ActionBarProps) {
  if (walk || running) {
    return (
      <div className={styles.actionBar}>
        <Button label={runLabel(walk, phaseCount, running)} disabled />
        <Button label="Stop" variant="secondary" onPress={onStop} />
      </div>
    );
  }
  if (placeholder) return null;
  if (phaseCount === 0) {
    return (
      <div className={styles.actionBar}>
        <Button
          label={busy === 'draft' ? 'Working…' : 'Draft plan'}
          onPress={onDraft}
          disabled={busy !== null}
        />
      </div>
    );
  }
  if (phasesDone) return null;
  return (
    <div className={styles.actionBar}>
      <Button
        label={busy === 'run-next' ? 'Working…' : 'Run next'}
        onPress={onRunNext}
        disabled={busy !== null}
      />
      <Button label="Run all" variant="secondary" onPress={onRunAll} disabled={busy !== null} />
    </div>
  );
}
