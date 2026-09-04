import { EmptyState } from '@/app/components';
import { formatDuration } from '@/core/phase-run';
import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { ProjectStats } from '@/types/index';
import type { RateLimitWindowKey } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { CAPACITY_STAMP } from '../constants';
import { StatCard, StatRow } from './stat-card';

const WINDOW_ROWS: { key: RateLimitWindowKey; label: string }[] = [
  { key: 'five_hour', label: '5-hour limit' },
  { key: 'seven_day', label: 'Weekly' },
];

export interface ClaudeCapacityCardProps {
  capacity: ProjectStats['capacity'];
}

export const ClaudeCapacityCard = ({ capacity }: ClaudeCapacityCardProps) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <StatCard title="Claude capacity">
      {capacity === null ? (
        <EmptyState message="No agent run has reported capacity yet." />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Stamp size="small" variant={CAPACITY_STAMP[capacityLevel(capacity.snapshot.status)]}>
              {capacity.snapshot.status}
            </Stamp>
            {capacity.snapshot.overage && (
              <Stamp size="small" variant="warning">
                overage
              </Stamp>
            )}
          </div>
          {WINDOW_ROWS.map(({ key, label }) => {
            const window = capacity.snapshot.unifiedWindows?.[key];
            if (!window) return null;
            const resets =
              window.resetsAt === undefined
                ? ''
                : ` · resets ${new Date(resetsAtMs(window.resetsAt)).toLocaleTimeString()}`;
            return (
              <StatRow
                key={key}
                label={label}
                value={`${Math.round(window.utilization * 100)}% used${resets}`}
              />
            );
          })}
          <span className="text-2xs opacity-50">
            as of last agent run,{' '}
            {formatDuration(Math.max(0, now - Date.parse(capacity.capturedAt)))} ago
          </span>
        </>
      )}
    </StatCard>
  );
};
