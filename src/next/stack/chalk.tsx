import type { ReactNode } from 'react';
import type { ServiceTone } from '@/core/service-status';
import styles from './stack.module.css';

const TONE_CLASS: Record<ServiceTone, string> = {
  pass: styles.pass,
  fail: styles.fail,
  running: styles.running,
  muted: styles.idle,
};

export function ChalkLabel({ children, side }: { children: ReactNode; side?: ReactNode }) {
  return (
    <h3 className={styles.label}>
      <span>{children}</span>
      {side ? <span className={styles.labelSide}>{side}</span> : null}
    </h3>
  );
}

export function ChalkCard({
  children,
  chip,
  label,
}: {
  children: ReactNode;
  chip?: string;
  label?: string;
}) {
  return (
    <div className={styles.card} role={label ? 'group' : undefined} aria-label={label}>
      {chip ? <span className={styles.chip}>{chip}</span> : null}
      {children}
    </div>
  );
}

export function ToneDot({ tone, label }: { tone: ServiceTone; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`${styles.dot} ${TONE_CLASS[tone]}`}
    />
  );
}
