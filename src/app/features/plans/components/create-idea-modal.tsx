import { space } from '@/app/styles/tokens';
import { Button, Input, Modal, Textarea } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface CreateIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (idea: { title: string; content?: string }) => Promise<void>;
}

export const CreateIdeaModal = ({ open, onClose, onAdd }: CreateIdeaModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;
    setLoading(true);
    await onAdd({ title: title.trim(), content: content.trim() || undefined });
    setLoading(false);
    onClose();
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
