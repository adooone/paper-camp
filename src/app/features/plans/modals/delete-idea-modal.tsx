import { space } from '@/app/styles/tokens';
import { Button, Modal } from '@dendelion/paper-ui';

interface DeleteIdeaModalProps {
  title: string | null;
  onClose: () => void;
  onConfirm: (title: string) => Promise<void>;
}

export const DeleteIdeaModal = ({ title, onClose, onConfirm }: DeleteIdeaModalProps) => {
  const handleConfirm = async () => {
    if (!title) return;
    await onConfirm(title);
    onClose();
  };

  return (
    <Modal open={title !== null} onClose={onClose} title="Delete idea" size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <p style={{ margin: 0 }}>Delete idea "{title}"?</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="danger" onClick={handleConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
};
