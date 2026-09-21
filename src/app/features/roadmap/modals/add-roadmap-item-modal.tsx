import { addRoadmapItem, patchRoadmapItem } from '@/app/services/content/docs-api';
import { useAppStore } from '@/app/stores/app-store';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Button, Input, Modal, Select } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';

interface Editing {
  horizonTitle: string;
  item: ResolvedRoadmapItem;
}

interface AddRoadmapItemModalProps {
  open: boolean;
  horizonTitles: string[];
  editing?: Editing | null;
  onClose: () => void;
}

export const AddRoadmapItemModal = ({
  open,
  horizonTitles,
  editing,
  onClose,
}: AddRoadmapItemModalProps) => {
  const loadRoadmap = useAppStore((s) => s.loadRoadmap);
  const [horizon, setHorizon] = useState(horizonTitles[0] ?? '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRename, setConfirmingRename] = useState(false);
  const horizonTitlesRef = useRef(horizonTitles);
  horizonTitlesRef.current = horizonTitles;

  useEffect(() => {
    if (open) {
      setHorizon(editing?.horizonTitle ?? horizonTitlesRef.current[0] ?? '');
      setName(editing?.item.name ?? '');
      setDescription(editing?.item.description ?? '');
      setError(null);
      setSaving(false);
      setConfirmingRename(false);
    }
  }, [open, editing]);

  const performSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await patchRoadmapItem(editing.horizonTitle, editing.item.name, {
          name: name.trim(),
          description: description.trim(),
        });
      } else {
        await addRoadmapItem(horizon, name.trim(), description.trim());
      }
      await loadRoadmap();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!name.trim() || !horizon) return;
    if (editing) {
      const renaming = name.trim() !== editing.item.name;
      if (renaming && editing.item.ideas.length > 0) {
        setConfirmingRename(true);
        return;
      }
    }
    performSave();
  };

  const affectedIdeas = editing?.item.ideas.length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit roadmap item' : 'Add roadmap item'}
      size="small"
    >
      {confirmingRename ? (
        <div className="flex flex-col gap-4">
          <p className="m-0 opacity-80">
            Renames the subject of {affectedIdeas} idea{affectedIdeas === 1 ? '' : 's'}.
          </p>
          {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmingRename(false)}
              disabled={saving}
            >
              Back
            </Button>
            <Button type="button" variant="primary" onClick={performSave} disabled={saving}>
              {saving ? 'Saving…' : 'Rename'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {editing ? (
            <p className="m-0 text-sm opacity-60">{editing.horizonTitle}</p>
          ) : (
            <Select
              size="small"
              value={horizon}
              onChange={setHorizon}
              disabled={saving}
              options={horizonTitles.map((title) => ({ value: title, label: title }))}
            />
          )}
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
              if (e.key === 'Enter') handleSave();
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
              onClick={handleSave}
              disabled={saving || !name.trim() || !horizon}
            >
              {saving ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save' : 'Add item'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
