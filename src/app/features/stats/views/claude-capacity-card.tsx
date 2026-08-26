import { formatDuration } from '@/core/phase-run';
import { capacityLevel, resetsAtMs } from '@/core/rate-limit';
import type { ProjectStats } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { CAPACITY_STAMP } from '../constants';
import { StatCard, StatRow } from './stat-card';

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
        <p className="opacity-50 m-0">No agent run has reported capacity yet.</p>
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
          {capacity.snapshot.rateLimitType && (
            <StatRow label="Window" value={capacity.snapshot.rateLimitType} />
          )}
          {capacity.snapshot.resetsAt !== undefined && (
            <StatRow
              label="Resets"
              value={new Date(resetsAtMs(capacity.snapshot.resetsAt)).toLocaleTimeString()}
            />
          )}
          <span className="text-2xs opacity-50">
            as of last agent run,{' '}
            {formatDuration(Math.max(0, now - Date.parse(capacity.capturedAt)))} ago
          </span>
        </>
      )}
    </StatCard>
  );
};
