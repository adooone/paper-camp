import { useRoadmapItemNames } from '@/app/features/roadmap';
import { configQueryKey } from '@/app/services/query-client';
import { useRuntimeConnection } from '@/app/services/runtime-connection';
import { fetchConfigAt } from '@/app/services/system';
import { useAppStore } from '@/app/stores/app-store';
import { useQueries } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  type PlanSortKey,
  type WorklistRow,
  groupRowsByProject,
  groupRowsBySubject,
} from '../helpers';

export const useWorklistRows = (rows: WorklistRow[]) => {
  const roadmapItemNames = useRoadmapItemNames();
  const navigate = useNavigate();
  const group = useAppStore((s) => s.planFilters.group);
  const sortKey = useAppStore((s) => s.planFilters.sortKey);
  const sortDirection = useAppStore((s) => s.planFilters.sortDirection);
  const setPlanSortKey = useAppStore((s) => s.setPlanSortKey);
  const togglePlanSortDirection = useAppStore((s) => s.togglePlanSortDirection);

  const handleSort = (key: PlanSortKey) => {
    if (key === sortKey) togglePlanSortDirection();
    else setPlanSortKey(key);
  };

  const { runtimeUrl } = useRuntimeConnection();
  const runtimeUrls = [
    ...new Set([runtimeUrl, ...rows.map((row) => row.project?.runtimeUrl ?? runtimeUrl)]),
  ];
  const configs = useQueries({
    queries: runtimeUrls.map((url) => ({
      queryKey: configQueryKey(url),
      queryFn: () => fetchConfigAt(url),
    })),
  });
  const vocabularies = new Map<string, Set<string>>();
  runtimeUrls.forEach((url, index) => {
    const subjects = configs[index]?.data?.subjects;
    if (!subjects) return;
    const vocabulary = new Set(subjects);
    vocabularies.set(url, vocabulary);
    if (url === runtimeUrl) vocabularies.set('', vocabulary);
  });
  const groups = groupRowsBySubject(rows, sortDirection, vocabularies);
  const showSubjectHeaders = group === 'subject' && groups.length > 1;

  const projectGroups = groupRowsByProject(rows);
  const showProjectHeaders = group === 'project' && projectGroups.length > 1;

  // Groups keep the sorted order of their rows, so a header sort holds under any grouping.
  const sortReflectsRows = true;

  return {
    roadmapItemNames,
    navigate,
    sortKey,
    sortDirection,
    handleSort,
    groups,
    showSubjectHeaders,
    projectGroups,
    showProjectHeaders,
    sortReflectsRows,
  };
};
