import { IntentButton } from '@/app/components';
import { color, fontFamily, fontSize, lineHeight, space } from '@/app/styles/tokens';
import type { PhaseItem, PlanEntry } from '@/types/index';
import { Modal } from '@dendelion/paper-ui';
import { useState } from 'react';
import { type DiffToken, diffWords } from '../diff';

interface ReconcileDiffPanelProps {
  plan: PlanEntry;
  before: { body: string; phases: PhaseItem[] };
  onApprove: () => void;
  onDiscard: () => Promise<void>;
}

const DiffText = ({ tokens }: { tokens: DiffToken[] }) => (
  <>
    {tokens.map((token, i) => {
      if (token.type === 'same') return <span key={`${token.type}-${i}`}>{token.text}</span>;
      const isAdded = token.type === 'added';
      return (
        <span
          key={`${token.type}-${i}`}
          style={{
            backgroundColor: isAdded ? 'rgba(143, 185, 150, 0.3)' : 'rgba(201, 139, 139, 0.3)',
            textDecoration: isAdded ? 'none' : 'line-through',
            color: isAdded ? color.accentGreenDark : color.accentRoseDark,
          }}
        >
          {token.text}
        </span>
      );
    })}
  </>
);

const sectionHeading = (text: string) => (
  <h4
    style={{
      fontFamily: fontFamily.serif,
      fontSize: fontSize.xs,
      fontWeight: 600,
      margin: `0 0 ${space[2]}`,
      opacity: 0.65,
    }}
  >
    {text}
  </h4>
);

export const ReconcileDiffPanel = ({
  plan,
  before,
  onApprove,
  onDiscard,
}: ReconcileDiffPanelProps) => {
  const [discarding, setDiscarding] = useState(false);

  const bodyChanged = plan.body !== before.body;
  const changedPhases = plan.phases
    .map((phase, i) => ({ phase, before: before.phases[i], index: i }))
    .filter(
      ({ phase, before: beforePhase }) =>
        beforePhase !== undefined &&
        (phase.text !== beforePhase.text ||
          (phase.description ?? '') !== (beforePhase.description ?? '')),
    );

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await onDiscard();
    } finally {
      setDiscarding(false);
    }
  };

  return (
    <Modal open title="Review reconcile changes" size="large" onClose={handleDiscard}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
        <p className="text-sm" style={{ margin: 0, opacity: 0.7 }}>
          The reconcile agent proposed the rewrite below for "{plan.title}". Approve to keep it, or
          discard to revert to the prior wording.
        </p>

        {!bodyChanged && changedPhases.length === 0 && (
          <p className="text-sm" style={{ margin: 0, opacity: 0.6 }}>
            No wording changed.
          </p>
        )}

        {bodyChanged && (
          <div>
            {sectionHeading('Body')}
            <p className="text-base" style={{ margin: 0, lineHeight: lineHeight.normal }}>
              <DiffText tokens={diffWords(before.body, plan.body)} />
            </p>
          </div>
        )}

        {changedPhases.length > 0 && (
          <div>
            {sectionHeading('Phases')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {changedPhases.map(({ phase, before: beforePhase, index }) => (
                <div key={index} className="text-sm" style={{ lineHeight: lineHeight.normal }}>
                  <DiffText tokens={diffWords(beforePhase.text, phase.text)} />
                  {(phase.description || beforePhase.description) && (
                    <div style={{ opacity: 0.85, marginTop: space[1] }}>
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <IntentButton intent="stop" size="small" onClick={handleDiscard} disabled={discarding}>
            Discard
          </IntentButton>
          <IntentButton intent="go" size="small" onClick={onApprove} disabled={discarding}>
            Approve
          </IntentButton>
        </div>
      </div>
    </Modal>
  );
};
