import { useCapacityReading, type WindowView } from '@/app/components/stack-panel/capacity-row';
import { Button } from '../ui/button';
import { Stamp, type StampMeaning } from '../ui/stamp';
import { ChalkCard } from './chalk';
import styles from './stack.module.css';

const LEVEL_FILL = {
  allowed: styles.pass,
  warning: styles.running,
  rejected: styles.fail,
} as const;

const LEVEL_MEANING: Record<keyof typeof LEVEL_FILL, StampMeaning> = {
  allowed: 'done',
  warning: 'parked',
  rejected: 'failed',
};

interface GaugeProps {
  label: string;
  view: WindowView | null;
  level: keyof typeof LEVEL_FILL;
  fallback: string;
  tooltip: string;
  neutral: boolean;
}

function Gauge({ label, view, level, fallback, tooltip, neutral }: GaugeProps) {
  const reset = view?.isReset ?? false;
  const pct = reset ? 0 : (view?.pct ?? 0);
  const meaning: StampMeaning = reset ? 'parked' : neutral ? 'idle' : LEVEL_MEANING[level];
  return (
    <div className={styles.gauge} title={tooltip}>
      <span className={styles.mono}>{label}</span>
      <div
        role="progressbar"
        aria-label={`${label} window`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className={styles.track}
      >
        <div className={`${styles.fill} ${LEVEL_FILL[level]}`} style={{ width: `${pct}%` }} />
      </div>
      <Stamp meaning={meaning}>{reset ? 'reset' : view ? `${pct}%` : fallback}</Stamp>
    </div>
  );
}

export function CapacityCard() {
  const { reading, refreshing, refresh } = useCapacityReading();
  return (
    <ChalkCard label="Capacity">
      <div className={styles.cardRow}>
        <span className={styles.title}>{reading.title}</span>
        <Button
          label={refreshing ? 'Checking…' : 'Refresh'}
          accessibilityLabel="Refresh capacity"
          variant="secondary"
          size="xs"
          onPress={refresh}
          disabled={refreshing}
        />
      </div>
      <Gauge
        label="5h"
        view={reading.fiveHour}
        level={reading.level}
        fallback={reading.fallback}
        tooltip={reading.fiveHourTooltip}
        neutral={reading.neutral}
      />
      <Gauge
        label="wk"
        view={reading.weekly}
        level={reading.level}
        fallback={reading.fallback}
        tooltip={reading.weeklyTooltip}
        neutral={reading.neutral}
      />
      {reading.overage ? <Stamp meaning="parked">overage</Stamp> : null}
    </ChalkCard>
  );
}
