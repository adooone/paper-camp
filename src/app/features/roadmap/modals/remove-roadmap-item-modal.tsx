import { deleteRoadmapItem } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Button, Modal } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface RemoveRoadmapItemModalProps {
  horizonTitle: string | null;
  item: ResolvedRoadmapItem | null;
  onClose: () => void;
}

export const RemoveRoadmapItemModal = ({
  horizonTitle,
  item,
  onClose,
}: RemoveRoadmapItemModalProps) => {
  const loadRoadmap = useAppStore((s) => s.loadRoadmap);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setRemoving(false);
      setError(null);
    }
  }, [item]);

  const handleRemove = async () => {
    if (!horizonTitle || !item) return;
    setRemoving(true);
    setError(null);
    try {
      await deleteRoadmapItem(horizonTitle, item.name);
      await loadRoadmap();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Modal open={item !== null} onClose={onClose} title="Remove roadmap item" size="small">
      <div className="flex flex-col gap-4">
        <p className="m-0 opacity-80">
          Remove <strong>{item?.name}</strong>? Its ideas keep their subject.
        </p>
        {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={removing}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
