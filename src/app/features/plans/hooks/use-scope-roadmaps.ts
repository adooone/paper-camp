import type { ScopeRow } from '@/app/features/scope';
import { fetchRoadmapAt } from '@/app/services/content/docs-api';
import type { ResolvedRoadmap } from '@/types/index';
import { useEffect, useState } from 'react';

export interface ScopeRoadmap {
  project: ScopeRow;
  roadmap: ResolvedRoadmap | null;
}

/** Fetches every other scope project's roadmap for the Horizon group-by's
 * per-project sections (IDEA-291). No filters apply here — the current
 * project's own horizon section keeps the toolbar's search/horizon filters,
 * a foreign section always shows the whole roadmap. */
export const useScopeRoadmaps = (otherProjects: ScopeRow[]): ScopeRoadmap[] => {
  const [data, setData] = useState<Record<string, ResolvedRoadmap | null>>({});
  const key = otherProjects.map((p) => p.runtimeUrl).join('\n');

  useEffect(() => {
    const urls = key === '' ? [] : key.split('\n');
    if (urls.length === 0) {
      setData({});
      return;
    }
    let cancelled = false;
    Promise.all(
      urls.map(async (runtimeUrl) => [runtimeUrl, await fetchRoadmapAt(runtimeUrl)] as const),
    ).then((entries) => {
      if (!cancelled) setData(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return otherProjects.map((project) => ({
    project,
    roadmap: data[project.runtimeUrl] ?? null,
  }));
};
