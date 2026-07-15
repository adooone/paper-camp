import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useState } from 'react';

export const ActualiseAllButton = () => {
  const launchBatchReconcile = useAppStore((s) => s.launchBatchReconcile);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const [launching, setLaunching] = useState(false);

  const agentBusy = agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

  const handleClick = async () => {
    setLaunching(true);
    try {
      await launchBatchReconcile();
    } catch (err) {
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
      disabled={agentBusy || launching}
      style={{ color: color.textSecondary }}
    >
      Actualise all
    </Button>
  );
};
