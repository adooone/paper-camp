import { type DiffToken, diffWords } from '@/app/features/plans/helpers';
import type { PhaseItem, PlanEntry } from '@/types/index';
import { Button, Modal } from '@dendelion/paper-ui';
import { useState } from 'react';

interface ReconcileDiffPanelProps {
  plan: PlanEntry;
  before: { body: string; phases: PhaseItem[] };
  onApprove: () => Promise<void>;
  onDiscard: () => Promise<void>;
  // 1-based position within a multi-entity review queue; omitted for a lone
  // single-plan reconcile where there's nothing to count against.
  queuePosition?: { index: number; total: number };
}

interface DiffTextProps {
  tokens: DiffToken[];
}

export const DiffText = ({ tokens }: DiffTextProps) => (
  <>
    {tokens.map((token, i) => {
      if (token.type === 'same') return <span key={`${token.type}-${i}`}>{token.text}</span>;
      const isAdded = token.type === 'added';
      return (
        <span
          key={`${token.type}-${i}`}
          className={
            isAdded
              ? 'bg-watercolor-green/[30%] text-watercolor-green-dark no-underline'
              : 'bg-watercolor-rose/[30%] text-watercolor-rose-dark line-through'
          }
        >
          {token.text}
        </span>
      );
    })}
  </>
);

export const sectionHeading = (text: string) => (
  <h4 className="font-display-luminari text-xs font-semibold mb-2 opacity-[0.65]">{text}</h4>
);

export const ReconcileDiffPanel = ({
  plan,
  before,
  onApprove,
  onDiscard,
  queuePosition,
}: ReconcileDiffPanelProps) => {
  const [discarding, setDiscarding] = useState(false);
  const [approving, setApproving] = useState(false);

  const bodyChanged = plan.body !== before.body;
  const changedPhases = plan.phases
    .map((phase, i) => ({ phase, before: before.phases[i], index: i }))
    .filter(
      ({ phase, before: beforePhase }) =>
        beforePhase !== undefined &&
        (phase.text !== beforePhase.text ||
          (phase.description ?? '') !== (beforePhase.description ?? '')),
    );

  const busy = discarding || approving;

  const handleDiscard = async () => {
    if (busy) return;
    setDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setDiscarding(false);
    }
  };

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <Modal
      open
      title={
        queuePosition
          ? `Review reconcile changes (${queuePosition.index} of ${queuePosition.total})`
          : 'Review reconcile changes'
      }
      size="large"
      onClose={busy ? () => {} : handleDiscard}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm m-0 opacity-70">
          The reconcile agent proposed the rewrite below for "{plan.title}". Approve to keep it, or
          discard to revert to the prior wording.
        </p>

        {!bodyChanged && changedPhases.length === 0 && (
          <p className="text-sm m-0 opacity-60">No wording changed.</p>
        )}

        {bodyChanged && (
          <div>
            {sectionHeading('Body')}
            <p className="text-base m-0 leading-normal">
              <DiffText tokens={diffWords(before.body, plan.body)} />
            </p>
          </div>
        )}

        {changedPhases.length > 0 && (
          <div>
            {sectionHeading('Phases')}
            <div className="flex flex-col gap-3">
              {changedPhases.map(({ phase, before: beforePhase, index }) => (
                <div key={index} className="text-sm leading-normal">
                  <DiffText tokens={diffWords(beforePhase.text, phase.text)} />
                  {(phase.description || beforePhase.description) && (
                    <div className="opacity-[0.85] mt-1">
                      <DiffText
                        tokens={diffWords(beforePhase.description ?? '', phase.description ?? '')}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="danger" size="small" onClick={handleDiscard} disabled={busy}>
            Discard
          </Button>
          <Button variant="primary" size="small" onClick={handleApprove} disabled={busy}>
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  );
};
