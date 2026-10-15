import { Button, Modal } from '@dendelion/folk-ui';

interface ClearChatModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  confirming: boolean;
  projectName?: string;
}

export const ClearChatModal = ({
  open,
  onClose,
  onConfirm,
  confirming,
  projectName,
}: ClearChatModalProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title={projectName ? `Clear ${projectName}'s chat?` : 'Clear chat?'}
    size="small"
  >
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm">
        This empties {projectName ? `${projectName}'s thread` : 'the thread'} except any unanswered
        question. There's no export or undo.
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
