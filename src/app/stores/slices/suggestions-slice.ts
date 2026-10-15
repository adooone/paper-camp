import { refreshIdeas, refreshPlans, refreshSuggestions } from '@/app/services/query-client';
import type { RoadmapItem, SuggestionEntry } from '@/types/index';
import {
  type PrioritiseResult,
  dismissSuggestion as dismissSuggestionApi,
  prioritiseQueue,
  promoteRoadmapItem as promoteRoadmapItemApi,
  promoteSuggestion as promoteSuggestionApi,
} from '../../services/content';
import type { GetState, SetState } from './slice-helpers';

export type SuggestionsSlice = {
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

export function createSuggestionsSlice(_set: SetState, get: GetState): SuggestionsSlice {
  return {
    promoteSuggestion: async (suggestion) => {
      const { id } = await promoteSuggestionApi(suggestion);
      await Promise.all([refreshSuggestions(), refreshPlans(), refreshIdeas()]);
      return id;
    },
    dismissSuggestion: async (suggestion) => {
      await dismissSuggestionApi(suggestion);
      await refreshSuggestions();
    },

    promoteRoadmapItem: async (horizonTitle, item, subject, candidateName) => {
      const { id } = await promoteRoadmapItemApi(horizonTitle, item, subject, candidateName);
      await Promise.all([refreshPlans(), refreshIdeas()]);
      return id;
    },

    launchPrioritise: async () => {
      const result = await prioritiseQueue();
      await get().refreshAll();
      return result;
    },
  };
}
