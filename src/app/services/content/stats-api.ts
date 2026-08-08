import type { ProjectStats } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchStats = async () => {
  const res = await fetch(apiUrl('/api/stats'));
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json() as Promise<ProjectStats>;
};
