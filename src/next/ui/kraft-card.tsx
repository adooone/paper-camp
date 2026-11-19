import type { ReactNode } from 'react';
import styles from './kraft-card.module.css';

interface KraftCardProps {
  children?: ReactNode;
  padding?: number;
  className?: string;
}

// folk-ui's Card draws a rough sketch border; the phone's card is a plain stroke with mismatched corners.
export function KraftCard({ children, padding = 16, className }: KraftCardProps) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')}>
      <div className={styles.body} style={{ padding }}>
        {children}
      </div>
    </div>
  );
}
