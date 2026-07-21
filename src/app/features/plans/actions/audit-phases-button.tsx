import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
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
  const hasAgent = useAppStore(selectHasAnyAgent);
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

  const hint = !plan.id
    ? 'Plan needs an ID before an agent can run'
    : !hasAgent
      ? 'No agent CLI found — set up in Settings'
      : undefined;

  return (
    <Tooltip content={hint}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={disabled || launching || !plan.id || !hasAgent}
      >
        Audit
      </Button>
    </Tooltip>
  );
};
