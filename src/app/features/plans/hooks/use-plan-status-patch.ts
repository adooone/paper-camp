import { updatePlan } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

// Shared by plan-actions-column.tsx and the review queue so approve/reject/dropped
// go through one updatePlan + reload + error-toast path instead of each caller reimplementing it.
export const usePlanStatusPatch = () => {
  const loadPlans = useAppStore((s) => s.loadPlans);
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);

  const patch = async (
    title: string,
    updates: Parameters<typeof updatePlan>[1],
    options?: { errorTitle?: string },
  ) => {
    setUpdating(true);
    try {
      await updatePlan(title, updates);
      await loadPlans();
      return true;
    } catch (err) {
      // e.g. the 409 branch-conflict guard when approving/closing off the plan's
      // own branch — surface it so the action doesn't just appear to do nothing.
      toast({
        title: options?.errorTitle ?? 'Update failed',
        description: (err as Error).message,
        variant: 'error',
      });
      return false;
    } finally {
      setUpdating(false);
    }
  };

  return { patch, updating };
};
