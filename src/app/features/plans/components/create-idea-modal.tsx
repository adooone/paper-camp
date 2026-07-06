import { color, fontSize, space } from '@/app/styles/tokens';
import { Button, Input, Modal, Switch, Textarea } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface CreateIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (idea: { title: string; content?: string; kind?: 'idea' | 'note' }) => Promise<void>;
}

export const CreateIdeaModal = ({ open, onClose, onAdd }: CreateIdeaModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setIsNote(false);
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
        kind: isNote ? 'note' : undefined,
      });
      onClose();
    } catch (err) {
      // Without this the modal stays stuck disabled if onAdd rejects; surface the
      // error and re-enable the form so the user can retry.
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New idea" size="small">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Idea title…"
          disabled={loading}
          autoFocus
          required
        />
        <Textarea
          label="Description"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Optional details…"
          disabled={loading}
          rows={4}
        />
        <Switch
          label="Note — never needs a plan"
          checked={isNote}
          onChange={(e) => setIsNote(e.target.checked)}
          disabled={loading}
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
