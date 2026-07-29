import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { LogEntry } from '@/types/index';
import { Button, Modal, Textarea, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface PromoteDecisionModalProps {
  entityId: string;
  source: 'comment' | 'clarification';
  entry: LogEntry | null;
  onClose: () => void;
}

export const PromoteDecisionModal = ({
  entityId,
  source,
  entry,
  onClose,
}: PromoteDecisionModalProps) => {
  const promoteToDecision = useAppStore((s) => s.promoteToDecision);
  const [title, setTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (entry) {
      setTitle(entry.text);
      setRationale('');
      setLoading(false);
      setError(null);
    }
  }, [entry]);

  const handlePromote = async () => {
    if (!entry || !title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await promoteToDecision(entityId, source, entry, title.trim(), rationale.trim());
      toast({ title: 'Promoted to a decision', variant: 'success' });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={entry !== null} onClose={onClose} title="Promote to a decision" size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <p style={{ margin: 0, opacity: 0.8 }}>{entry?.text}</p>
        <Textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Decision title"
          rows={2}
          disabled={loading}
        />
        <Textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Rationale (optional — defaults to the source text)"
          rows={3}
          disabled={loading}
        />
        {error && (
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handlePromote}
            disabled={loading || !title.trim()}
          >
            {loading ? 'Promoting…' : 'Promote to decision'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
