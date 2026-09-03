import type { CapacityStat } from '@/types/index';
import { refreshCapacityProbe } from '../../services/system/capacity-api';
import type { SetState } from './slice-helpers';

export type CapacitySlice = {
  /** A probe reading, preferred over the task log until the next run supersedes it. */
  probedCapacity: CapacityStat | null;
  refreshCapacity: () => Promise<void>;
};

export function createCapacitySlice(set: SetState): CapacitySlice {
  return {
    probedCapacity: null,
    refreshCapacity: async () => {
      const stat = await refreshCapacityProbe().catch(() => null);
      if (stat) set({ probedCapacity: stat });
    },
  };
}
