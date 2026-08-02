import type { ProjectStats } from '@/types/index';

export const fetchStats = async () => {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json() as Promise<ProjectStats>;
};
