import { CodeBlock } from '@dendelion/folk-ui';
import type { FileDiffEntry } from '@/types/index';
import { diffBody, diffCounts, diffPathLabel } from '../shell/diff-model';
import { describeEntryStatus } from '../shell/git-model';
import { Button } from '../ui/button';
import { Stamp } from '../ui/stamp';
import styles from './diff.module.css';

interface FileDiffProps {
  entry: FileDiffEntry;
  collapsed: boolean;
  pending: boolean;
  onToggleCollapsed: () => void;
  onToggleStaged: () => void;
}

export function FileDiff({
  entry,
  collapsed,
  pending,
  onToggleCollapsed,
  onToggleStaged,
}: FileDiffProps) {
  const stamp = describeEntryStatus(entry);
  const counts = diffCounts(entry);
  const body = diffBody(entry);
  return (
    <section className={styles.file} aria-label={diffPathLabel(entry)}>
      <div className={styles.fileHead}>
        <div className={styles.fileMain}>
          <span className={styles.path}>{diffPathLabel(entry)}</span>
          <span className={styles.meta}>
            <Stamp meaning={stamp.meaning}>{stamp.label}</Stamp>
            {entry.staged && stamp.label !== 'staged' ? <Stamp meaning="done">staged</Stamp> : null}
            {counts ? <span className={styles.counts}>{counts}</span> : null}
          </span>
        </div>
        <div className={styles.actions}>
          <Button
            label={collapsed ? 'Show' : 'Hide'}
            variant="ghost"
            size="sm"
            onPress={onToggleCollapsed}
            accessibilityLabel={`${collapsed ? 'Show' : 'Hide'} ${entry.path}`}
          />
          <Button
            label={entry.staged ? 'Unstage' : 'Stage'}
            variant="secondary"
            size="sm"
            onPress={onToggleStaged}
            disabled={pending}
            accessibilityLabel={`${entry.staged ? 'Unstage' : 'Stage'} ${entry.path}`}
          />
        </div>
      </div>
      {collapsed ? null : body.kind === 'code' ? (
        <CodeBlock code={body.code} surface="chalkboard" />
      ) : (
        <span className={styles.empty}>{body.text}</span>
      )}
    </section>
  );
}
