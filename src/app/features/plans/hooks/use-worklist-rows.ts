import { useRoadmapItemNames } from '@/app/features/roadmap';
import { useSubjectVocabulary } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  DEFAULT_GROUP_MODE,
  type PlanSortKey,
  type WorklistRow,
  groupRowsByProject,
  groupRowsBySubject,
  isGroupMode,
} from '../helpers';

export const useWorklistRows = (rows: WorklistRow[]) => {
  const {
    subjects: validSubjects,
    loading: subjectsLoading,
    available: subjectsAvailable,
  } = useSubjectVocabulary();
  const roadmapItemNames = useRoadmapItemNames();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const group = isGroupMode(search.group) ? search.group : DEFAULT_GROUP_MODE;
  const sortKey = useAppStore((s) => s.planFilters.sortKey);
  const sortDirection = useAppStore((s) => s.planFilters.sortDirection);
  const setPlanSortKey = useAppStore((s) => s.setPlanSortKey);
  const togglePlanSortDirection = useAppStore((s) => s.togglePlanSortDirection);

  const handleSort = (key: PlanSortKey) => {
    if (key === sortKey) togglePlanSortDirection();
    else setPlanSortKey(key);
    // A manual sort order conflicts with subject/project sub-grouping, so sorting drops back to Plain.
    if (group === 'subject' || group === 'project') {
      navigate({ to: '/', search: { ...search, group: 'plain' } });
    }
  };

  const groups = groupRowsBySubject(
    rows,
    sortDirection,
    subjectsLoading || !subjectsAvailable ? undefined : validSubjects,
  );
  const showSubjectHeaders = group === 'subject' && groups.length > 1;

  const projectGroups = groupRowsByProject(rows);
  const showProjectHeaders = group === 'project' && projectGroups.length > 1;

  const sortReflectsRows = !showSubjectHeaders && !showProjectHeaders;

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
