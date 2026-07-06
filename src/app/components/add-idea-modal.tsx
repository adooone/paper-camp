import { color, fontSize, space } from '@/app/styles/tokens';
import { PLAN_KINDS } from '@/types/index';
import { Button, Input, Modal, Select, Textarea } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface AddIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (idea: { title: string; content?: string; kind: string }) => Promise<void>;
}

const kindOptions = PLAN_KINDS.map((k) => ({ value: k, label: k }));

export const AddIdeaModal = ({ open, onClose, onAdd }: AddIdeaModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('feat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setKind('feat');
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      await onAdd({
        title: title.trim(),
        content: content.trim() || undefined,
        kind,
      });
      onClose();
    } catch (err) {
      // Surface the failure and re-enable the form so the user can retry —
      // without the finally the modal would stay stuck disabled on any onAdd reject.
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick plan" size="small">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Backlog item title…"
          disabled={loading}
          autoFocus
          required
        />
        <Select
          label="Kind"
          value={kind}
          onChange={(value) => setKind(value)}
          options={kindOptions}
          disabled={loading}
        />
        <Textarea
          label="Description"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Optional details…"
          disabled={loading}
          rows={4}
        />
        {error && (
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || loading}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
};
