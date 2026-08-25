import { Button, Input } from '@dendelion/paper-ui';
import { useState } from 'react';

interface AddCandidateFormProps {
  onAdd: (name: string) => Promise<void>;
}

export const AddCandidateForm = ({ onAdd }: AddCandidateFormProps) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim());
      setName('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        size="small"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAdd();
        }}
        placeholder="Add option…"
        disabled={saving}
        className="flex-1"
      />
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={handleAdd}
        disabled={saving || !name.trim()}
      >
        Add
      </Button>
    </div>
  );
};
