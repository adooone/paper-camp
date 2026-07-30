import { space } from '@/app/styles/tokens';
import type { MarginNote, MarginNoteKind } from '@/types/index';
import {
  Button,
  CheckIcon,
  IconButton,
  LightbulbIcon,
  Modal,
  Select,
  Stamp,
  Textarea,
  Tooltip,
} from '@dendelion/paper-ui';
import { useState } from 'react';

const NOTE_KIND_OPTIONS = [
  { value: 'note', label: 'Note' },
  { value: 'decision', label: 'Decision' },
  { value: 'question', label: 'Question' },
];

const NOTE_KIND_LABEL: Record<MarginNoteKind, string> = {
  note: 'Note',
  decision: 'Decision',
  question: 'Question',
};

interface AddMarginNoteButtonProps {
  label: string;
  onAdd: (prose: string, kind: MarginNoteKind) => Promise<boolean>;
  disabled?: boolean;
}

export const AddMarginNoteButton = ({ label, onAdd, disabled }: AddMarginNoteButtonProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [kind, setKind] = useState<MarginNoteKind>('note');
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setInput('');
    setKind('note');
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      if (await onAdd(input.trim(), kind)) handleClose();
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
          <Select
            label="Type"
            options={NOTE_KIND_OPTIONS}
            value={kind}
            onChange={(value) => setKind(value as MarginNoteKind)}
            disabled={submitting}
          />
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
          <span
            className="text-sm"
            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: space[2], opacity: 0.85 }}
          >
            {note.kind && note.kind !== 'note' && (
              <Stamp size="small" variant={note.kind === 'decision' ? 'info' : 'warning'}>
                {NOTE_KIND_LABEL[note.kind]}
              </Stamp>
            )}
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
