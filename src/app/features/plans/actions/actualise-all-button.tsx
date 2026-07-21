import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

export const ActualiseAllButton = () => {
  const launchBatchReconcile = useAppStore((s) => s.launchBatchReconcile);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const [launching, setLaunching] = useState(false);

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
    <Tooltip content={hasAgent ? undefined : 'No agent CLI found — set up in Settings'}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={launching || !hasAgent}
        style={{ color: color.textSecondary }}
      >
        Actualise all
      </Button>
    </Tooltip>
  );
};
