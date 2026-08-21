import { Button, IconButton, Input, Modal, PlusIcon, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface AddTicketButtonProps {
  onAdd: (title: string) => Promise<void>;
  disabled?: boolean;
}

export const AddTicketButton = ({ onAdd, disabled }: AddTicketButtonProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setOpen(false);
    setTitle('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(title.trim());
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip content="Add a ticket to this board">
        <IconButton
          variant="ghost"
          size="small"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Add a ticket to this board"
          icon={<PlusIcon size={16} />}
        />
      </Tooltip>
      <Modal open={open} onClose={handleClose} title="Add ticket" size="small">
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ticket title…"
            disabled={submitting}
            autoFocus
            required
          />
          {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
            >
              Add
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
