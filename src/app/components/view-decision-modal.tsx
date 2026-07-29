import { Markdown } from '@/app/components/markdown';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { DecisionEntry } from '@/types/index';
import { Button, Modal, Stamp, Textarea, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface ViewDecisionModalProps {
  decision: DecisionEntry | null;
  onClose: () => void;
}

export const ViewDecisionModal = ({ decision, onClose }: ViewDecisionModalProps) => {
  const supersedeDecision = useAppStore((s) => s.supersedeDecision);
  const [superseding, setSuperseding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (decision) {
      setSuperseding(false);
      setNewTitle('');
      setRationale('');
      setLoading(false);
      setError(null);
    }
  }, [decision]);

  const handleHonour = () => {
    toast({ title: 'Decision stands', variant: 'success' });
    onClose();
  };

  const handleSupersede = async () => {
    if (!decision || !newTitle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await supersedeDecision(decision.title, newTitle.trim(), rationale.trim());
      toast({ title: 'Decision superseded', variant: 'success' });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={decision !== null} onClose={onClose} title={decision?.title ?? ''} size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <div style={{ display: 'flex', gap: space[2], alignItems: 'center' }}>
          <Stamp size="small" variant={decision?.status === 'superseded' ? 'warning' : 'success'}>
            {decision?.status ?? ''}
          </Stamp>
          <span style={{ fontFamily: fontFamily.mono, fontSize: fontSize.sm, opacity: 0.7 }}>
            {decision?.date}
          </span>
        </div>
        {decision?.supersededBy && (
          <p style={{ margin: 0, fontSize: fontSize.sm, opacity: 0.8 }}>
            Superseded by "{decision.supersededBy}"
          </p>
        )}
        <Markdown>{decision?.body ?? ''}</Markdown>

        {decision?.status === 'decided' &&
          (superseding ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              <Textarea
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New decision — what supersedes this?"
                rows={2}
                disabled={loading}
              />
              <Textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Rationale (optional)"
                rows={3}
                disabled={loading}
              />
              {error && (
                <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>
                  {error}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSuperseding(false)}
                  disabled={loading}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSupersede}
                  disabled={loading || !newTitle.trim()}
                >
                  {loading ? 'Superseding…' : 'Supersede'}
                </Button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
              <Button type="button" variant="ghost" onClick={() => setSuperseding(true)}>
                Supersede…
              </Button>
              <Button type="button" variant="primary" onClick={handleHonour}>
                Honour
              </Button>
            </div>
          ))}
      </div>
    </Modal>
  );
};
