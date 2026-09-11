import { RunIcon } from '@/app/components/icons';
import { SidebarCommand } from '@/app/components/sidebar';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface RunAllPhasesButtonProps {
  plan: PlanEntry;
  disabled?: boolean;
}

export const RunAllPhasesButton = ({ plan, disabled }: RunAllPhasesButtonProps) => {
  const launchRunAll = useAppStore((s) => s.launchRunAll);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const [launching, setLaunching] = useState(false);

  const handleClick = async () => {
    if (!plan.id) return;
    setLaunching(true);
    try {
      await launchRunAll(plan.id);
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
      <SidebarCommand
        icon={<RunIcon size={16} />}
        onClick={handleClick}
        disabled={disabled || !plan.id || !hasAgent}
        busy={launching ? 'Starting…' : undefined}
      >
        Run all phases
      </SidebarCommand>
    </Tooltip>
  );
};
