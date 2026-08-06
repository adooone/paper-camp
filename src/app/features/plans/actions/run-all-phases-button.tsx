import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { ListItem, Tooltip } from '@dendelion/paper-ui';
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

  const isDisabled = disabled || launching || !plan.id || !hasAgent;
  const hint = !plan.id
    ? 'Plan needs an ID before an agent can run'
    : !hasAgent
      ? 'No agent CLI found — set up in Settings'
      : undefined;

  return (
    <Tooltip content={hint}>
      <ListItem
        size="small"
        icon={<span className="text-ink-500">▶</span>}
        onClick={handleClick}
        disabled={isDisabled}
        className={`text-xs leading-4 py-2 ${isDisabled ? 'opacity-50' : ''}`}
      >
        {launching ? 'Starting…' : 'Run all phases'}
      </ListItem>
    </Tooltip>
  );
};
