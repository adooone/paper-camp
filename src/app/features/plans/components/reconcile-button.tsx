import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Button } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';
import { buildReconcilePrompt } from '../prompts';

interface ReconcileButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const ReconcileButton = ({ plan, disabled }: ReconcileButtonProps) => {
  const launchPlanReconcile = useAppStore((s) => s.launchPlanReconcile);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const setReconcilePreview = useAppStore((s) => s.setReconcilePreview);
  const [launching, setLaunching] = useState(false);
  const pending = useRef<{
    planId: string;
    before: { body: string; phases: PlanEntry['phases'] };
  } | null>(null);

  // Once the launched reconcile task finishes, refresh the plan (so it reflects
  // the agent's rewrite) and hand the pre-launch snapshot to the diff panel.
  useEffect(() => {
    const task = pending.current;
    if (
      !task ||
      !agentStatus ||
      agentStatus.taskKind !== 'reconcile' ||
      agentStatus.planId !== task.planId
    ) {
      return;
    }
    if (agentStatus.status === 'done') {
      pending.current = null;
      loadPlans().then(() => setReconcilePreview(task));
    } else if (agentStatus.status === 'error') {
      pending.current = null;
    }
  }, [agentStatus, loadPlans, setReconcilePreview]);

  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      pending.current = { planId: plan.id, before: { body: plan.body, phases: plan.phases } };
      await launchPlanReconcile(plan.id, buildReconcilePrompt(plan));
    } catch (err) {
      pending.current = null;
      alert((err as Error).message);
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
      Reconcile
    </Button>
  );
};
