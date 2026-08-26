import { fetchStats } from '@/app/services/content';
import type { ProjectStats } from '@/types/index';
import { useEffect, useState } from 'react';

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
