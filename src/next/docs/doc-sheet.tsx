import type { ReactNode } from 'react';
import { Hand } from '../ui/hand';
import { Paper } from '../ui/paper';
import styles from './docs.module.css';

interface DocSheetProps {
  title: string;
  children: ReactNode;
}

export function DocSheet({ title, children }: DocSheetProps) {
  return (
    <Paper className={styles.sheet}>
      <article className={styles.sheetBody} aria-label={title}>
        <Hand as="h2" size="xl" font="display">
          {title}
        </Hand>
        {children}
      </article>
    </Paper>
  );
}
