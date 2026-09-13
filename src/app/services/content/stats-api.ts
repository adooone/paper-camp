import type { ProjectStats } from '@/types/index';
import { apiUrl } from '../api-base';

export const fetchStats = async () => {
  const res = await fetch(apiUrl('/api/stats'));
  if (!res.ok) throw new Error(`Failed to fetch stats: ${res.status}`);
  return res.json() as Promise<ProjectStats>;
};

// The registry holds runtimes this client is not currently pointed at, so the base
// URL is explicit rather than taken from `apiUrl` — mirrors `fetchPackageNameAt`.
export const fetchStatsAt = async (baseUrl: string): Promise<ProjectStats | null> => {
  try {
    const res = await fetch(`${baseUrl}/api/stats`);
    if (!res.ok) return null;
    return (await res.json()) as ProjectStats;
  } catch {
    return null;
  }
};
