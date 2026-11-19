import type { ReactNode } from 'react';
import styles from './paper.module.css';

interface PaperProps {
  children?: ReactNode;
  className?: string;
}

// folk-ui's Page is parchment with a sketched edge; the phone's ground is a flat sheet under a grain tile.
export function Paper({ children, className }: PaperProps) {
  return (
    <div className={[styles.ground, className].filter(Boolean).join(' ')}>
      <div className={styles.grain} aria-hidden="true" />
      {children}
    </div>
  );
}
