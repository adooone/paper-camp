import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import type { OpenQuestionEntry } from '@/types/index';
import { Button, Modal, Textarea, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface ResolveQuestionModalProps {
  question: OpenQuestionEntry | null;
  onClose: () => void;
}

export const ResolveQuestionModal = ({ question, onClose }: ResolveQuestionModalProps) => {
  const resolveOpenQuestion = useAppStore((s) => s.resolveOpenQuestion);
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (question) {
      setDecision('');
      setRationale('');
      setLoading(false);
      setError(null);
    }
  }, [question]);

  const handleResolve = async () => {
    if (!question || !decision.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await resolveOpenQuestion(question.title, decision.trim(), rationale.trim());
      toast({ title: 'Question resolved', variant: 'success' });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={question !== null} onClose={onClose} title={question?.title ?? ''} size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <p style={{ margin: 0, opacity: 0.8 }}>{question?.body}</p>
        <Textarea
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          placeholder="Decision — what did we settle on?"
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
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleResolve}
            disabled={loading || !decision.trim()}
          >
            {loading ? 'Resolving…' : 'Resolve into decision'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
