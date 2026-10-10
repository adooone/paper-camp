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

/** Fetches and filters every other scope project's worklist rows the same way
 * `selectWorklistRows` builds the current project's own, tagging each row
 * with the project it came from (IDEA-291). No server merges this — the
 * browser fans out to each project's runtime and joins the results here. */
export const useScopeWorklist = (
  otherProjects: ScopeRow[],
  filters: PlanListFilters,
): WorklistRow[] => {
  const [data, setData] = useState<Record<string, ProjectData>>({});
  const key = otherProjects.map((p) => p.runtimeUrl).join('\n');

  useEffect(() => {
    const urls = key === '' ? [] : key.split('\n');
    if (urls.length === 0) {
      setData({});
      return;
    }
    let cancelled = false;
    Promise.all(
      urls.map(async (runtimeUrl) => {
        const [plansResult, ideasResult] = await Promise.all([
          fetchPlansAt(runtimeUrl),
          fetchIdeasAt(runtimeUrl),
        ]);
        return [
          runtimeUrl,
          { plans: plansResult?.entries ?? [], ideas: ideasResult?.entries ?? [] },
        ] as const;
      }),
    ).then((entries) => {
      if (!cancelled) setData(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return otherProjects.flatMap((project) => {
    const projectData = data[project.runtimeUrl];
    if (!projectData) return [];
    const { rows } = selectWorklistRows(projectData.plans, projectData.ideas, filters);
    return rows.map((row) => ({ ...row, project }));
  });
};
