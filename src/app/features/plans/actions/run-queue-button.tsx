import { useAppStore } from '@/app/stores/app-store';
import { Button, RunIcon } from '@dendelion/folk-ui';
import { useEffect } from 'react';

export const RunQueueButton = () => {
  const preview = useAppStore((s) => s.batchPreview);
  const loadBatchPreview = useAppStore((s) => s.loadBatchPreview);
  const openBatchSheet = useAppStore((s) => s.openBatchSheet);

  useEffect(() => {
    loadBatchPreview();
  }, [loadBatchPreview]);

  const readyCount = preview?.readyCount ?? 0;

  return (
    <Button variant="primary" icon={<RunIcon size={16} />} size="small" onClick={openBatchSheet}>
      Run queue ({readyCount})
    </Button>
  );
};
