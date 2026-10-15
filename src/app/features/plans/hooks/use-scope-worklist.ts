import type { ScopeRow } from '@/app/features/scope';
import { fetchIdeasAt } from '@/app/services/content/ideas-api';
import { fetchPlansAt } from '@/app/services/content/plans-api';
import { ideasQueryKey, plansQueryKey } from '@/app/services/query-client';
import { useQueries } from '@tanstack/react-query';
import { type PlanListFilters, type WorklistRow, selectWorklistRows } from '../helpers';

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
  const plansQueries = useQueries({
    queries: otherProjects.map((project) => ({
      queryKey: plansQueryKey(project.runtimeUrl),
      queryFn: async () => (await fetchPlansAt(project.runtimeUrl)) ?? { entries: [] },
    })),
  });
  const ideasQueries = useQueries({
    queries: otherProjects.map((project) => ({
      queryKey: ideasQueryKey(project.runtimeUrl),
      queryFn: async () => (await fetchIdeasAt(project.runtimeUrl))?.entries ?? [],
    })),
  });

  const rows = otherProjects.flatMap((project, index) => {
    const plans = plansQueries[index]?.data;
    const ideas = ideasQueries[index]?.data;
    if (!plans || !ideas) return [];
    const { rows: projectRows } = selectWorklistRows(plans.entries, ideas, filters);
    return projectRows.map((row) => ({ ...row, project }));
  });
  const pendingProjects = otherProjects.filter(
    (_project, index) => !plansQueries[index]?.data || !ideasQueries[index]?.data,
  );

  return { rows, pendingProjects };
};
