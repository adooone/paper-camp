import { DraftPlanButton } from '@/app/features/plans/actions/draft-plan-button';
import { PlanIdStamp } from '@/app/features/plans/components/plan-id-stamp';
import { usePlanStatusPatch } from '@/app/features/plans/hooks';
import { useSimilarIdeas } from '@/app/hooks';
import { checkIdeaOverlap } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import type { IdeaEntry, LogEntry, OverlapVerdict } from '@/types/index';
import { PLAN_KINDS } from '@/types/index';
import { Button, Card, Input, Modal, Select, Textarea, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

interface AddIdeaModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (idea: { title: string; content?: string; kind: string }) => Promise<void>;
}

const kindOptions = PLAN_KINDS.map((k) => ({ value: k, label: k }));

export const AddIdeaModal = ({ open, onClose, onAdd }: AddIdeaModalProps) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('feat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [checkingOverlap, setCheckingOverlap] = useState(false);
  const [overlapVerdict, setOverlapVerdict] = useState<OverlapVerdict | null>(null);
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const planEntries = useAppStore((s) => s.plans?.entries ?? []);
  const { patch } = usePlanStatusPatch();
  const navigate = useNavigate();
  const { toast } = useToast();
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
      setKind('feat');
      setLoading(false);
      setError(null);
      setCheckingOverlap(false);
      setOverlapVerdict(null);
      setOverlapError(null);
    }
  }, [open]);

  // Clear the verdict when the text changes so stale overlap guidance isn't shown.
  // biome-ignore lint/correctness/useExhaustiveDependencies: text is a trigger, not read
  useEffect(() => {
    setOverlapVerdict(null);
    setOverlapError(null);
  }, [title, content]);

  const handleOpenSimilar = (matchTitle: string) => {
    onClose();
    navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(matchTitle) } });
  };

  const handleCheckOverlap = async () => {
    const text = `${title.trim()}${content.trim() ? `\n\n${content.trim()}` : ''}`;
    if (!text) return;
    setCheckingOverlap(true);
    setOverlapError(null);
    setOverlapVerdict(null);
    try {
      const candidates = planEntries.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        tags: p.tags,
      }));
      setOverlapVerdict(await checkIdeaOverlap(text, candidates));
    } catch (err) {
      setOverlapError((err as Error).message);
    } finally {
      setCheckingOverlap(false);
    }
  };

  const handleOpenVerdictTarget = (targetId: string) => {
    const match = planEntries.find((p) => p.id === targetId);
    if (match) {
      handleOpenSimilar(match.title);
    } else {
      // Stale/hallucinated id from the verdict — tell the user instead of no-op.
      toast({
        title: 'Plan not found',
        description: `No plan with id ${targetId}`,
        variant: 'error',
      });
    }
  };

  const handleExtendSimilar = async (
    candidateId: string,
    candidateTitle: string,
    existingLog: LogEntry[] | undefined,
  ) => {
    setExtendingId(candidateId);
    const today = new Date().toISOString().slice(0, 10);
    const newLog: LogEntry = { date: today, text: title.trim() };
    const ok = await patch(
      candidateTitle,
      { log: [...(existingLog ?? []), newLog] },
      { errorTitle: 'Extend failed' },
    );
    setExtendingId(null);
    if (ok) onClose();
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
        kind,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Quick plan" size="small">
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}
      >
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Backlog item title…"
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
                      <PlanIdStamp id={candidate.id} />
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
                          candidate.id &&
                          handleExtendSimilar(candidate.id, candidate.title, candidate.log)
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          <div>
            <Button
              type="button"
              variant="ghost"
              size="small"
              disabled={!title.trim() || checkingOverlap}
              onClick={handleCheckOverlap}
            >
              {checkingOverlap ? 'Checking overlap…' : 'Check overlap'}
            </Button>
          </div>
          {overlapError && (
            <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>
              {overlapError}
            </p>
          )}
          {overlapVerdict && (
            <Card size="small" texture="canvas">
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                <span style={{ fontWeight: 600 }}>
                  {overlapVerdict.verdict === 'new'
                    ? 'Looks genuinely new'
                    : overlapVerdict.verdict === 'extend'
                      ? `Extends ${overlapVerdict.targetId ?? 'an existing idea'}`
                      : `Belongs inside ${overlapVerdict.targetId ?? 'an existing idea'}`}
                </span>
                <span style={{ fontSize: fontSize.sm, opacity: 0.8 }}>
                  {overlapVerdict.reasoning}
                </span>
                {overlapVerdict.targetId && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="small"
                      onClick={() => handleOpenVerdictTarget(overlapVerdict.targetId as string)}
                    >
                      Open it
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
        <Select
          label="Kind"
          value={kind}
          onChange={(value) => setKind(value)}
          options={kindOptions}
          disabled={loading}
        />
        <Textarea
          label="Description"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Optional details…"
          disabled={loading}
          rows={4}
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
