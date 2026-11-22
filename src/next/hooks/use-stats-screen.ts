import { useCallback, useEffect, useState } from 'react';
import { fetchStats } from '@/app/services/content';
import type { ProjectStats } from '@/types/index';

export interface StatsScreenState {
  load: 'loading' | 'unreachable' | 'ready';
  stats: ProjectStats | null;
  reload: () => void;
}

export function useStatsScreen(): StatsScreenState {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(() => {
    setFailed(false);
    fetchStats()
      .then(setStats)
      .catch(() => setFailed(true));
  }, []);

  useEffect(reload, [reload]);

  return { load: stats ? 'ready' : failed ? 'unreachable' : 'loading', stats, reload };
}
