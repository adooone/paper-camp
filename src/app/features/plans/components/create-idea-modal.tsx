import { useSimilarIdeas } from '@/app/hooks';
import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import type { IdeaEntry, LogEntry } from '@/types/index';
import { Button, Card, Input, Modal, Stamp, Switch, Textarea, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DraftPlanButton } from './draft-plan-button';

interface CreateIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (idea: { title: string; content?: string; kind?: 'idea' | 'note' }) => Promise<void>;
}

export const CreateIdeaModal = ({ open, onClose, onAdd }: CreateIdeaModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const planEntries = useAppStore((s) => s.plans?.entries ?? []);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const navigate = useNavigate();
  const { toast } = useToast();
  // Include `log` alongside the base candidate shape — Extend/Draft need it,
  // beyond what the "Open it"-only shape from the previous phase carried.
  const similarIdeas = useSimilarIdeas(
    title,
    planEntries.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      tags: p.tags,
      log: p.log,
    })),
  );

  useEffect(() => {
    if (open) {
      setTitle('');
      setContent('');
      setIsNote(false);
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const handleOpenSimilar = (matchTitle: string) => {
    onClose();
    navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(matchTitle) } });
  };

  const handleExtendSimilar = async (candidateId: string, existingLog: LogEntry[] | undefined) => {
    setExtendingId(candidateId);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const newLog: LogEntry = { date: today, text: title.trim() };
      await updatePlan(candidateId, { log: [...(existingLog ?? []), newLog] });
      await loadPlans();
      onClose();
    } catch (err) {
      toast({ title: 'Extend failed', description: (err as Error).message, variant: 'error' });
    } finally {
      setExtendingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;
    setError(null);
    setLoading(true);
    try {
      await onAdd({
        title: title.trim(),
        content: content.trim() || undefined,
        kind: isNote ? 'note' : undefined,
      });
      onClose();
    } catch (err) {
      // Without this the modal stays stuck disabled if onAdd rejects; surface the
      // error and re-enable the form so the user can retry.
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New idea" size="small">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Idea title…"
          disabled={loading}
          autoFocus
          required
        />
        {similarIdeas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
            <span style={{ fontSize: fontSize.sm, opacity: 0.6, fontWeight: 600 }}>
              Similar ideas
            </span>
            {similarIdeas.map(({ candidate }) => {
              const ideaView: IdeaEntry = {
                id: candidate.id ?? null,
                title: candidate.title,
                body: candidate.body,
                log: candidate.log,
              };
              const otherPlans = planEntries.filter((p) => p.id !== candidate.id);
              return (
                <Card key={candidate.id ?? candidate.title} size="small" texture="canvas">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: space[2], minWidth: 0 }}
                    >
                      {candidate.id && (
                        <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
                          {candidate.id}
                        </Stamp>
                      )}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {candidate.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        onClick={() => handleOpenSimilar(candidate.title)}
                      >
                        Open it
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="small"
                        disabled={!candidate.id || !title.trim() || extendingId !== null}
                        onClick={() =>
                          candidate.id && handleExtendSimilar(candidate.id, candidate.log)
                        }
                      >
                        {extendingId === candidate.id ? 'Extending…' : 'Extend it instead'}
                      </Button>
                      <DraftPlanButton idea={ideaView} otherPlans={otherPlans} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        <Textarea
          label="Description"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Optional details…"
          disabled={loading}
          rows={4}
        />
        <Switch
          label="Note — never needs a plan"
          checked={isNote}
          onChange={(e) => setIsNote(e.target.checked)}
          disabled={loading}
        />
        {error && (
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!title.trim() || loading}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
};
