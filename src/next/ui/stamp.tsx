import type { ReactNode } from 'react';
import styles from './stamp.module.css';

export type StampMeaning = 'running' | 'done' | 'failed' | 'parked' | 'idle';

interface StampProps {
  meaning?: StampMeaning;
  children: ReactNode;
}

// folk-ui's Stamp is a rotated rubber stamp; the phone's is a flat mono pill.
export function Stamp({ meaning = 'idle', children }: StampProps) {
  return <span className={`${styles.stamp} ${styles[meaning]}`}>{children}</span>;
}
