import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildReconcilePrompt } from '../prompts';

interface ReconcileButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const ReconcileButton = ({ plan, disabled }: ReconcileButtonProps) => {
  const launchPlanReconcile = useAppStore((s) => s.launchPlanReconcile);
  const [launching, setLaunching] = useState(false);

  // The pre-launch snapshot and completion handling live in the store
  // (see launchPlanReconcile / loadAgentStatus), so an in-flight reconcile still
  // surfaces its diff panel even if this button unmounts (user navigates away).
  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      await launchPlanReconcile(plan.id, buildReconcilePrompt(plan), {
        body: plan.body,
        phases: plan.phases,
      });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Tooltip content={plan.id ? undefined : 'Plan needs an ID before an agent can run'}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={disabled || launching || !plan.id}
      >
        Refresh
      </Button>
    </Tooltip>
  );
};
