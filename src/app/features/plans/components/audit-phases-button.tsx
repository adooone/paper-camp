import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Button } from '@dendelion/paper-ui';
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
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={disabled || launching || !plan.id}
      title={plan.id ? undefined : 'Plan needs an ID before an agent can run'}
      style={{ color: color.textSecondary }}
    >
      Audit phases against code
    </Button>
  );
};
