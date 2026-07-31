import type { RoadmapItem, SuggestionEntry } from '@/types/index';
import {
  type PrioritiseResult,
  dismissSuggestion as dismissSuggestionApi,
  fetchSuggestions,
  prioritiseQueue,
  promoteRoadmapItem as promoteRoadmapItemApi,
  promoteSuggestion as promoteSuggestionApi,
} from '../../services/content';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type SuggestionsSlice = {
  suggestions: SuggestionEntry[];
  suggestionsLoading: boolean;
  loadSuggestions: () => Promise<void>;
  promoteSuggestion: (suggestion: SuggestionEntry) => Promise<string>;
  dismissSuggestion: (suggestion: SuggestionEntry) => Promise<void>;

  promoteRoadmapItem: (
    horizonTitle: string,
    item: RoadmapItem,
    subject?: string,
    candidateName?: string,
  ) => Promise<string>;

  launchPrioritise: () => Promise<PrioritiseResult>;
};

export function createSuggestionsSlice(set: SetState, get: GetState): SuggestionsSlice {
  return {
    suggestions: [],
    suggestionsLoading: true,
    loadSuggestions: loadSlice(
      set,
      fetchSuggestions,
      (data) => ({ suggestions: data.entries }),
      () => ({ suggestions: [] }),
      'suggestionsLoading',
    ),
    promoteSuggestion: async (suggestion) => {
      const { id } = await promoteSuggestionApi(suggestion);
      await Promise.all([get().loadSuggestions(), get().loadPlans(), get().loadIdeas()]);
      return id;
    },
    dismissSuggestion: async (suggestion) => {
      await dismissSuggestionApi(suggestion);
      await get().loadSuggestions();
    },

    promoteRoadmapItem: async (horizonTitle, item, subject, candidateName) => {
      const { id } = await promoteRoadmapItemApi(horizonTitle, item, subject, candidateName);
      await Promise.all([get().loadPlans(), get().loadIdeas()]);
      return id;
    },

    launchPrioritise: async () => {
      const result = await prioritiseQueue();
      await get().refreshAll();
      return result;
    },
  };
}
