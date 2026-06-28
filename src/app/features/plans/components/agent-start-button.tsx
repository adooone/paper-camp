import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { IconButton } from '@dendelion/paper-ui';
import { useState } from 'react';

interface AgentStartButtonProps {
  planId?: string;
  phaseIndex: number;
  disabled?: boolean;
}

export const AgentStartButton = ({ planId, phaseIndex, disabled }: AgentStartButtonProps) => {
  const launchAgent = useAppStore((s) => s.launchAgent);
  const [launching, setLaunching] = useState(false);

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!planId) return;
    setLaunching(true);
    try {
      await launchAgent(planId, phaseIndex);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <IconButton
      icon={<span style={{ fontSize: 12, lineHeight: 1 }}>▶</span>}
      variant="ghost"
      size="small"
      label={planId ? 'Start agent on this phase' : 'Plan needs an ID before an agent can run'}
      onClick={handleStart}
      disabled={disabled || launching || !planId}
      className="transition-opacity"
      style={{ color: color.textSecondary }}
    />
  );
};
