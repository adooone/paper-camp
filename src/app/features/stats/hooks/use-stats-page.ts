import { useEffect, useState } from 'react';
import { fetchStats } from '@/app/services/content';
import type { ProjectStats } from '@/types/index';

export const useStatsPage = () => {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => setLoadFailed(true));
  }, []);

  return { stats, loadFailed };
};
