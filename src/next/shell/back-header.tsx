import type { ReactNode } from 'react';
import { Hand } from '../ui/hand';
import styles from './back-header.module.css';

interface BackHeaderProps {
  onBack: () => void;
  label?: string;
  trailing?: ReactNode;
}

export function BackHeader({ onBack, label, trailing }: BackHeaderProps) {
  return (
    <div className={styles.header}>
      <button type="button" onClick={onBack} className={styles.back}>
        <Hand size="base" bold color="inkSoft">
          ← Back
        </Hand>
      </button>
      {label ? (
        <Hand size="sm" color="inkFaint">
          {label}
        </Hand>
      ) : null}
      {trailing ?? <span className={styles.spacer} />}
    </div>
  );
}
