import { parseReviewFindings } from '@/app/features/plans/helpers';
import type { PhaseItem } from '@/types/index';
import { Alert, Button, IconButton, Modal, PlusIcon, Textarea, Tooltip } from '@dendelion/paper-ui';
import { useState } from 'react';

interface AddReviewPhasesButtonProps {
  onAdd: (phases: PhaseItem[]) => Promise<void>;
  disabled?: boolean;
}

export const AddReviewPhasesButton = ({ onAdd, disabled }: AddReviewPhasesButtonProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setInput('');
    setError(null);
  };

  const handleSubmit = async () => {
    let phases: PhaseItem[];
    try {
      phases = parseReviewFindings(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not parse findings');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(phases);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Tooltip content="Add code-review findings as phases">
        <IconButton
          variant="ghost"
          size="small"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Add code-review findings as phases"
          icon={<PlusIcon size={16} />}
        />
      </Tooltip>
      <Modal open={open} onClose={handleClose} title="Add code-review findings" size="small">
        <div className="flex flex-col gap-4">
          <p className="text-sm m-0 opacity-70">
            Paste the JSON findings from a <code>/code-review</code> run. Each finding becomes a
            new, unchecked phase on this plan.
          </p>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='[{ "description": "...", "file": "src/foo.ts", "line_start": 12, "failure_scenario": "..." }]'
            rows={10}
            disabled={submitting}
          />
          {error && <Alert variant="warning">Could not add phases — {error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !input.trim()}
            >
              Add phases
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
