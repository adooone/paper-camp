import { useRoadmapItemNames } from '@/app/features/roadmap';
import { useSubjectVocabulary } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import {
  type PlanSortKey,
  type WorklistRow,
  groupRowsByProject,
  groupRowsBySubject,
} from '../helpers';

export const useWorklistRows = (rows: WorklistRow[]) => {
  const {
    subjects: validSubjects,
    loading: subjectsLoading,
    available: subjectsAvailable,
  } = useSubjectVocabulary();
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

  const groups = groupRowsBySubject(
    rows,
    sortDirection,
    subjectsLoading || !subjectsAvailable ? undefined : validSubjects,
  );
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
