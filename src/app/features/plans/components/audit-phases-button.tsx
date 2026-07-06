import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildConvergenceAuditPrompt } from '../prompts';

interface AuditPhasesButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const AuditPhasesButton = ({ plan, disabled }: AuditPhasesButtonProps) => {
  const launchPlanAudit = useAppStore((s) => s.launchPlanAudit);
  const [launching, setLaunching] = useState(false);

  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      await launchPlanAudit(plan.id, buildConvergenceAuditPrompt(plan));
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Tooltip content={plan.id ? undefined : 'Plan needs an ID before an agent can run'}>
      <Button
        variant="secondary"
        size="small"
        onClick={handleClick}
        disabled={disabled || launching || !plan.id}
      >
        Audit phases against code
      </Button>
    </Tooltip>
  );
};
