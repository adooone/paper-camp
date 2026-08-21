import { useRoadmapItemNames } from '@/app/features/roadmap';
import { useSubjectVocabulary } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { useNavigate } from '@tanstack/react-router';
import { type PlanSortKey, type WorklistRow, groupRowsBySubject } from '../helpers';

export const useWorklistRows = (rows: WorklistRow[]) => {
  const {
    subjects: validSubjects,
    loading: subjectsLoading,
    available: subjectsAvailable,
  } = useSubjectVocabulary();
  const roadmapItemNames = useRoadmapItemNames();
  const navigate = useNavigate();
  const sortKey = useAppStore((s) => s.planFilters.sortKey);
  const sortDirection = useAppStore((s) => s.planFilters.sortDirection);
  const groupBySubject = useAppStore((s) => s.planFilters.groupBySubject);
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
  const showSubjectHeaders = groupBySubject && groups.length > 1;
  const sortReflectsRows = !showSubjectHeaders;

  return {
    roadmapItemNames,
    navigate,
    sortKey,
    sortDirection,
    handleSort,
    groups,
    showSubjectHeaders,
    sortReflectsRows,
  };
};
