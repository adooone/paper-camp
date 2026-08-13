import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Checkbox, Modal } from '@dendelion/paper-ui';
import { useEffect, useRef, useState } from 'react';

interface DraftAllModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
}

export const DraftAllModal = ({ open, onClose, onConfirm }: DraftAllModalProps) => {
  const planEntries = useAppStore((s) => s.plans?.entries ?? []);
  const candidates = planEntries.filter(
    (p): p is PlanEntry & { id: string } =>
      !!p.id && p.phases.length === 0 && p.status !== 'done' && p.status !== 'dropped',
  );
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read via ref, not a dependency: candidates should only be re-snapshotted when the
  // modal opens, not on every worklist refresh while it's open and the user is picking.
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;

  useEffect(() => {
    if (open) {
      setChecked(new Set(candidatesRef.current.map((c) => c.id)));
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await onConfirm([...checked]);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Draft all" size="small">
      <div className="flex flex-col gap-4">
        <p className="m-0 opacity-80">
          {candidates.length} undrafted idea{candidates.length === 1 ? '' : 's'} will be turned into
          a plan.
        </p>
        {candidates.length > 0 && (
          <div className="flex max-h-[16rem] flex-col gap-2 overflow-y-auto">
            {candidates.map((c) => (
              <Checkbox
                key={c.id}
                label={c.title}
                checked={checked.has(c.id)}
                onChange={() => toggle(c.id)}
              />
            ))}
          </div>
        )}
        {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || checked.size === 0}
          >
            {loading ? 'Starting…' : `Draft ${checked.size}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
