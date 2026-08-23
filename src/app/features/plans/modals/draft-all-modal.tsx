import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Checkbox, Modal } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface DraftAllModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => Promise<void>;
}

type DraftCandidate = PlanEntry & { id: string };

export const DraftAllModal = ({ open, onClose, onConfirm }: DraftAllModalProps) => {
  const planEntries = useAppStore((s) => s.plans?.entries ?? []);
  const [candidates, setCandidates] = useState<DraftCandidate[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshotted only on open, not on every worklist refresh while the user is picking.
  // biome-ignore lint/correctness/useExhaustiveDependencies: planEntries is read as of the open transition, not tracked continuously.
  useEffect(() => {
    if (open) {
      const snapshot = planEntries.filter(
        (p): p is DraftCandidate => !!p.id && p.phases.length === 0 && p.status === 'idea',
      );
      setCandidates(snapshot);
      setChecked(new Set(snapshot.map((c) => c.id)));
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
