import { LinkButton, Markdown } from '@/app/components';
import { resolveOpenQuestion } from '@/app/services/docs-api';
import { useAppStore } from '@/app/stores';
import { color, fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import { Button, Input, Modal, Stamp, Textarea } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

export const OpenQuestionDetail = () => {
  const openQuestions = useAppStore((s) => s.openQuestions);
  const activeDocTitle = useAppStore((s) => s.activeDocTitle);
  const setActiveDocTitle = useAppStore((s) => s.setActiveDocTitle);
  const loadDecisions = useAppStore((s) => s.loadDecisions);
  const loadOpenQuestions = useAppStore((s) => s.loadOpenQuestions);
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [decision, setDecision] = useState('');
  const [rationale, setRationale] = useState('');
  const [loading, setLoading] = useState(false);

  const question = openQuestions.find((q) => q.title === activeDocTitle);
  if (!question) return null;

  const handleResolvedByClick = () => {
    if (question.resolvedBy) {
      navigate({ to: '/docs/$section', params: { section: 'decisions' } });
      setActiveDocTitle(question.resolvedBy);
    }
  };

  const handleOpenModal = () => {
    setDecision('');
    setRationale('');
    setLoading(false);
    setModalOpen(true);
  };

  const handleClose = () => {
    setModalOpen(false);
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.trim() || loading) return;
    setLoading(true);
    try {
      await resolveOpenQuestion(question.title, decision.trim(), rationale.trim() || undefined);
      setModalOpen(false);
      await Promise.all([loadDecisions(), loadOpenQuestions()]);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2
        style={{
          fontFamily: fontFamily.serif,
          fontWeight: 600,
          fontSize: '1.75rem',
          margin: `0 0 ${space[3]}`,
          lineHeight: lineHeight.tight,
        }}
      >
        {question.title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: space[2], marginBottom: space[5] }}>
        <span className="text-sm" style={{ opacity: 0.5 }}>
          {question.raised}
        </span>
        <Stamp
          size="small"
          fillColor={
            question.status === 'open' ? 'rgba(212, 163, 115, 0.25)' : 'rgba(143, 185, 150, 0.25)'
          }
          textColor={question.status === 'open' ? color.accentAmberDark : color.accentGreenDark}
        >
          {question.status}
        </Stamp>
        {question.resolvedBy && (
          <span className="text-sm" style={{ opacity: 0.5 }}>
            Resolved by{' '}
            <LinkButton onClick={handleResolvedByClick}>{question.resolvedBy}</LinkButton>
          </span>
        )}
        {question.status === 'open' && (
          <Button surface="chalkboard" onClick={handleOpenModal}>
            Resolve
          </Button>
        )}
      </div>

      <div
        style={{
          fontFamily: fontFamily.body,
          fontSize: fontSize.base,
          lineHeight: lineHeight.relaxed,
          color: '#1C1B18',
        }}
      >
        <Markdown>{question.body}</Markdown>
      </div>

      <Modal open={modalOpen} onClose={handleClose} title="Resolve question" size="small">
        <form
          onSubmit={handleResolve}
          style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}
        >
          <Input
            label="Decision"
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            placeholder="What was decided?"
            disabled={loading}
            autoFocus
            required
          />
          <Textarea
            label="Rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="Optional reasoning…"
            disabled={loading}
            rows={4}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!decision.trim() || loading}>
              Resolve
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
