import { Button, Modal } from '@dendelion/paper-ui';

interface ClearChatModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

export const ClearChatModal = ({ open, onClose, onConfirm, confirming }: ClearChatModalProps) => (
  <Modal open={open} onClose={onClose} title="Clear chat?" size="small">
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm">
        This empties the thread except any unanswered question. There's no export or undo.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={confirming}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={onConfirm} disabled={confirming}>
          {confirming ? 'Clearing…' : 'Clear chat'}
        </Button>
      </div>
    </div>
  </Modal>
);
