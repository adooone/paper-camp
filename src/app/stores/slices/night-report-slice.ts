import type { NightReportGroup, NightSuggestionEntry } from '@/types/index';
import {
  dismissNightFinding as dismissNightFindingApi,
  fetchNightReport,
  promoteNightFinding as promoteNightFindingApi,
} from '../../services/content';
import type { GetState, SetState } from './slice-helpers';
import { loadSlice } from './slice-helpers';

export type NightReportSlice = {
  nightReport: NightReportGroup[];
  loadNightReport: () => Promise<void>;
  promoteNightFinding: (finding: NightSuggestionEntry) => Promise<string>;
  dismissNightFinding: (finding: NightSuggestionEntry) => Promise<void>;
};

export function createNightReportSlice(set: SetState, get: GetState): NightReportSlice {
  return {
    nightReport: [],
    loadNightReport: loadSlice(set, fetchNightReport, (data) => ({ nightReport: data.groups })),
    promoteNightFinding: async (finding) => {
      const { id } = await promoteNightFindingApi(finding);
      await Promise.all([get().loadNightReport(), get().loadPlans(), get().loadIdeas()]);
      return id;
    },
    dismissNightFinding: async (finding) => {
      await dismissNightFindingApi(finding);
      await get().loadNightReport();
    },
  };
}
