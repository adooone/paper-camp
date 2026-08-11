import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { IconButton, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';

interface AgentStartButtonProps {
  planId?: string;
  phaseIndex: number;
  disabled?: boolean;
}

export const AgentStartButton = ({ planId, phaseIndex, disabled }: AgentStartButtonProps) => {
  const launchAgent = useAppStore((s) => s.launchAgent);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!planId) return;
    setLaunching(true);
    try {
      await launchAgent(planId, phaseIndex);
    } catch (err) {
      toast({
        title: 'Failed to start agent',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setLaunching(false);
    }
  };

  const label = !planId
    ? 'Plan needs an ID before an agent can run'
    : !hasAgent
      ? 'No agent CLI found — set up in Settings'
      : 'Start agent on this phase';

  return (
    <IconButton
      // Raw glyph: paper-ui has no play/run icon.
      icon={<span className="text-xs leading-none">▶</span>}
      variant="ghost"
      size="small"
      label={label}
      onClick={handleStart}
      disabled={disabled || launching || !planId || !hasAgent}
      className="text-ink-500"
    />
  );
};
