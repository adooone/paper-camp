import type { ReactNode } from 'react';
import { Hand } from '../ui/hand';
import { Stamp } from '../ui/stamp';
import styles from './title-row.module.css';

interface TitleRowProps {
  title: string;
  projectName?: string;
  onOpenSwitcher: () => void;
  stamp?: string;
  island?: ReactNode;
}

export function TitleRow({ title, projectName, onOpenSwitcher, stamp, island }: TitleRowProps) {
  return (
    <header className={styles.row}>
      <div className={styles.titleWrap}>
        <Hand as="h1" font="display" size="2xl">
          {title}
        </Hand>
        {projectName ? (
          <button
            type="button"
            aria-label={`Switch project, current ${projectName}`}
            onClick={onOpenSwitcher}
            className={styles.switcher}
          >
            <Hand size="sm" color="inkSoft" numberOfLines={1}>
              {projectName}
            </Hand>
            <span className={styles.caret} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {island ? <div className={styles.island}>{island}</div> : null}
      {!island && stamp ? (
        <div className={styles.right}>
          <Stamp meaning="running">{stamp}</Stamp>
        </div>
      ) : null}
    </header>
  );
}
