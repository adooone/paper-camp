import type { ScopeRow } from '@/app/features/scope';
import { fetchIdeasAt } from '@/app/services/content/ideas-api';
import { fetchPlansAt } from '@/app/services/content/plans-api';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { useEffect, useState } from 'react';
import { type PlanListFilters, type WorklistRow, selectWorklistRows } from '../helpers';

interface ProjectData {
  plans: PlanEntry[];
  ideas: IdeaEntry[];
}

/** Holds every project's last-fetched rows for the page's lifetime (IDEA-298);
 * replaced by the shared query cache in IDEA-299. */
const scopeProjectDataCache = new Map<string, ProjectData>();

export function cachedScopeProjectData(urls: string[]): Record<string, ProjectData> {
  const cached: Record<string, ProjectData> = {};
  for (const url of urls) {
    const projectData = scopeProjectDataCache.get(url);
    if (projectData) cached[url] = projectData;
  }
  return cached;
}

export async function loadScopeProjectData(runtimeUrl: string): Promise<ProjectData> {
  const [plansResult, ideasResult] = await Promise.all([
    fetchPlansAt(runtimeUrl),
    fetchIdeasAt(runtimeUrl),
  ]);
  const projectData = { plans: plansResult?.entries ?? [], ideas: ideasResult?.entries ?? [] };
  scopeProjectDataCache.set(runtimeUrl, projectData);
  return projectData;
}

export interface ScopeWorklistResult {
  rows: WorklistRow[];
  pendingProjects: ScopeRow[];
}

/** Fetches and filters every other scope project's worklist rows the same way
 * `selectWorklistRows` builds the current project's own, tagging each row
 * with the project it came from (IDEA-291). No server merges this — the
 * browser fans out to each project's runtime and joins the results here. */
export const useScopeWorklist = (
  otherProjects: ScopeRow[],
  filters: PlanListFilters,
): ScopeWorklistResult => {
  const key = otherProjects.map((p) => p.runtimeUrl).join('\n');
  const [data, setData] = useState<Record<string, ProjectData>>(() =>
    cachedScopeProjectData(key === '' ? [] : key.split('\n')),
  );

  useEffect(() => {
    const urls = key === '' ? [] : key.split('\n');
    setData(cachedScopeProjectData(urls));
    if (urls.length === 0) return;
    let cancelled = false;
    for (const runtimeUrl of urls) {
      loadScopeProjectData(runtimeUrl).then((projectData) => {
        if (!cancelled) setData((prev) => ({ ...prev, [runtimeUrl]: projectData }));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [key]);

  const rows = otherProjects.flatMap((project) => {
    const projectData = data[project.runtimeUrl];
    if (!projectData) return [];
    const { rows: projectRows } = selectWorklistRows(projectData.plans, projectData.ideas, filters);
    return projectRows.map((row) => ({ ...row, project }));
  });
  const pendingProjects = otherProjects.filter((project) => !data[project.runtimeUrl]);

  return { rows, pendingProjects };
};
