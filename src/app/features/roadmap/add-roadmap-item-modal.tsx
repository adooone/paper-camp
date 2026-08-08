import { addRoadmapItem } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import { Button, Input, Modal, Select } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface AddRoadmapItemModalProps {
  open: boolean;
  horizonTitles: string[];
  onClose: () => void;
}

export const AddRoadmapItemModal = ({ open, horizonTitles, onClose }: AddRoadmapItemModalProps) => {
  const loadRoadmap = useAppStore((s) => s.loadRoadmap);
  const [horizon, setHorizon] = useState(horizonTitles[0] ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHorizon(horizonTitles[0] ?? '');
      setName('');
      setDescription('');
      setError(null);
      setSaving(false);
    }
  }, [open, horizonTitles]);

  const handleAdd = async () => {
    if (!name.trim() || !horizon) return;
    setSaving(true);
    setError(null);
    try {
      await addRoadmapItem(horizon, name.trim(), description.trim());
      await loadRoadmap();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add roadmap item" size="small">
      <div className="flex flex-col gap-4">
        <Select
          size="small"
          value={horizon}
          onChange={setHorizon}
          disabled={saving}
          options={horizonTitles.map((title) => ({ value: title, label: title }))}
        />
        <Input
          size="small"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name…"
          disabled={saving}
          autoFocus
        />
        <Input
          size="small"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder="Description…"
          disabled={saving}
        />
        {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleAdd}
            disabled={saving || !name.trim() || !horizon}
          >
            {saving ? 'Adding…' : 'Add item'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
