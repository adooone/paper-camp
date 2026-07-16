import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button } from '@dendelion/paper-ui';
import { useState } from 'react';

export const ActualiseAllButton = () => {
  const launchBatchReconcile = useAppStore((s) => s.launchBatchReconcile);
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
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={launching}
      style={{ color: color.textSecondary }}
    >
      Actualise all
    </Button>
  );
};
