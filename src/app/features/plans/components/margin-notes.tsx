import { space } from '@/app/styles/tokens';
import type { MarginNote } from '@/types/index';
import {
  Button,
  CheckIcon,
  IconButton,
  LightbulbIcon,
  Modal,
  Textarea,
  Tooltip,
} from '@dendelion/paper-ui';
import { useState } from 'react';

interface AddMarginNoteButtonProps {
  label: string;
  onAdd: (prose: string) => Promise<boolean>;
  disabled?: boolean;
}

export const AddMarginNoteButton = ({ label, onAdd, disabled }: AddMarginNoteButtonProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setInput('');
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      if (await onAdd(input.trim())) handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip content={label}>
        <IconButton
          variant="ghost"
          size="small"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label={label}
          icon={<LightbulbIcon size={16} />}
        />
      </Tooltip>
      <Modal open={open} onClose={handleClose} title={label} size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="What should change here?"
            rows={4}
            disabled={submitting}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || disabled || !input.trim()}
            >
              Add note
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

interface MarginNotesListProps {
  notes: MarginNote[];
  onResolve: (note: MarginNote) => Promise<boolean>;
  disabled?: boolean;
}

export const MarginNotesList = ({ notes, onResolve, disabled }: MarginNotesListProps) => {
  const [resolving, setResolving] = useState<MarginNote | null>(null);

  if (notes.length === 0) return null;

  const handleResolve = async (note: MarginNote) => {
    setResolving(note);
    try {
      await onResolve(note);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
      {notes.map((note, i) => (
        <div
          key={`${note.prose}-${i}`}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: space[2],
            background: 'rgba(0,0,0,0.05)',
            borderRadius: space[2],
            padding: `${space[2]} ${space[3]}`,
          }}
        >
          <span className="text-sm" style={{ flex: 1, opacity: 0.85 }}>
            {note.prose}
          </span>
          <Tooltip content="Resolve note">
            <IconButton
              variant="ghost"
              size="small"
              onClick={() => handleResolve(note)}
              disabled={disabled || resolving !== null}
              aria-label="Resolve note"
              icon={<CheckIcon size={16} />}
            />
          </Tooltip>
        </div>
      ))}
    </div>
  );
};
