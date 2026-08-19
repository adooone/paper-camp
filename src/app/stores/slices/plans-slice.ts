import {
  DEFAULT_PLAN_LIST_FILTERS,
  type PlanListFilters,
  type PlanSortKey,
} from '@/app/features/plans/helpers';
import { readLocalDraft, writeLocalDraft } from '@/app/utils/local-draft-store';
import type { IdeaStatus, ParseResult, PlanEntry, PlanStatus } from '@/types/index';
import { fetchPlans } from '../../services/content';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type DetailView = 'details' | 'feedback';

const PLAN_FILTERS_KEY = 'plan-filters';
const DETAIL_VIEW_KEY = 'detail-view';

function readStoredPlanFilters(): PlanListFilters {
  return readLocalDraft<PlanListFilters>(PLAN_FILTERS_KEY) ?? DEFAULT_PLAN_LIST_FILTERS;
}

function readStoredDetailView(): DetailView {
  return readLocalDraft<DetailView>(DETAIL_VIEW_KEY) ?? 'details';
}

function storePlanFilters(filters: PlanListFilters): PlanListFilters {
  writeLocalDraft(PLAN_FILTERS_KEY, filters);
  return filters;
}

export type PlansSlice = {
  plans: ParseResult<PlanEntry> | null;
  plansLoading: boolean;
  plansError: string | null;
  loadPlans: () => Promise<void>;

  // Lifted here (not local state) so the sidebar filter column and the list share one source.
  planFilters: PlanListFilters;
  togglePlanStatus: (status: PlanStatus) => void;
  togglePlanTag: (tag: string) => void;
  toggleNoteStatus: (status: IdeaStatus) => void;
  setPlanSearch: (search: string) => void;
  setSubjectFilter: (subject: string | null) => void;
  setPlanSortKey: (sortKey: PlanSortKey) => void;
  togglePlanSortDirection: () => void;
  toggleGroupBySubject: () => void;

  // Which detail view the open plan shows; lifted so the sidebar switcher and
  // the content agree. Reset to 'details' when the open plan changes.
  detailView: DetailView;
  setDetailView: (view: DetailView) => void;
};

export function createPlansSlice(set: SetState, _get: GetState): PlansSlice {
  return {
    plans: null,
    plansLoading: false,
    plansError: null,
    loadPlans: loadSlice(
      set,
      fetchPlans,
      (data) => ({ plans: data, plansError: null }),
      (err) => ({ plansError: String(err) }),
      'plansLoading',
    ),

    planFilters: readStoredPlanFilters(),
    togglePlanStatus: (status) =>
      set((s) => ({
        planFilters: storePlanFilters({
          ...s.planFilters,
          statuses: s.planFilters.statuses.includes(status)
            ? s.planFilters.statuses.filter((x) => x !== status)
            : [...s.planFilters.statuses, status],
        }),
      })),
    togglePlanTag: (tag) =>
      set((s) => ({
        planFilters: storePlanFilters({
          ...s.planFilters,
          tags: s.planFilters.tags.includes(tag)
            ? s.planFilters.tags.filter((x) => x !== tag)
            : [...s.planFilters.tags, tag],
        }),
      })),
    toggleNoteStatus: (status) =>
      set((s) => ({
        planFilters: storePlanFilters({
          ...s.planFilters,
          noteStatuses: s.planFilters.noteStatuses.includes(status)
            ? s.planFilters.noteStatuses.filter((x) => x !== status)
            : [...s.planFilters.noteStatuses, status],
        }),
      })),
    setPlanSearch: (search) =>
      set((s) => ({ planFilters: storePlanFilters({ ...s.planFilters, search }) })),
    setSubjectFilter: (subject) =>
      set((s) => ({ planFilters: storePlanFilters({ ...s.planFilters, subject }) })),
    setPlanSortKey: (sortKey) =>
      set((s) => ({
        planFilters: storePlanFilters({ ...s.planFilters, sortKey, groupBySubject: false }),
      })),
    togglePlanSortDirection: () =>
      set((s) => ({
        planFilters: storePlanFilters({
          ...s.planFilters,
          sortDirection: s.planFilters.sortDirection === 'asc' ? 'desc' : 'asc',
          groupBySubject: false,
        }),
      })),
    toggleGroupBySubject: () =>
      set((s) => ({
        planFilters: storePlanFilters({
          ...s.planFilters,
          groupBySubject: !s.planFilters.groupBySubject,
        }),
      })),

    detailView: readStoredDetailView(),
    setDetailView: (view) => {
      writeLocalDraft(DETAIL_VIEW_KEY, view);
      set({ detailView: view });
    },
  };
}
