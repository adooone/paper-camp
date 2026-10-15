import { refreshIdeas, refreshNightReport, refreshPlans } from '@/app/services/query-client';
import type { NightSuggestionEntry } from '@/types/index';
import {
  dismissNightFinding as dismissNightFindingApi,
  promoteNightFinding as promoteNightFindingApi,
} from '../../services/content';

export type NightReportSlice = {
  promoteNightFinding: (finding: NightSuggestionEntry) => Promise<string>;
  dismissNightFinding: (finding: NightSuggestionEntry) => Promise<void>;
};

export function createNightReportSlice(): NightReportSlice {
  return {
    promoteNightFinding: async (finding) => {
      const { id } = await promoteNightFindingApi(finding);
      await Promise.all([refreshNightReport(), refreshPlans(), refreshIdeas()]);
      return id;
    },
    dismissNightFinding: async (finding) => {
      await dismissNightFindingApi(finding);
      await refreshNightReport();
    },
  };
}
