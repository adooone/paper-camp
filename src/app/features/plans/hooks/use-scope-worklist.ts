import type { ScopeRow } from '@/app/features/scope';
import { fetchWorklistAt } from '@/app/services/content/entities-api';
import { worklistQueryKey } from '@/app/services/query-client';
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
  const queries = useQueries({
    queries: otherProjects.map((project) => ({
      queryKey: worklistQueryKey(project.runtimeUrl),
      queryFn: () => fetchWorklistAt(project.runtimeUrl),
    })),
  });

  const rows = otherProjects.flatMap((project, index) => {
    const worklist = queries[index]?.data;
    if (!worklist) return [];
    const { rows: projectRows } = selectWorklistRows(worklist, filters);
    return projectRows.map((row) => ({ ...row, project }));
  });
  const pendingProjects = otherProjects.filter((_project, index) => !queries[index]?.data);

  return { rows, pendingProjects };
};
