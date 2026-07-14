import { parseReviewFindings } from '@/app/features/plans/helpers';
import { space } from '@/app/styles/tokens';
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
      <Tooltip content="Add /code-review findings as phases">
        <IconButton
          variant="ghost"
          size="small"
          onClick={() => setOpen(true)}
          disabled={disabled}
          aria-label="Add code-review findings as phases"
          icon={<PlusIcon size={16} />}
        />
      </Tooltip>
      <Modal open={open} onClose={handleClose} title="Add /code-review findings" size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
          <p className="text-sm" style={{ margin: 0, opacity: 0.7 }}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
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
