import { diffWords } from '@/app/features/plans/helpers';
import { fontFamily, space } from '@/app/styles/tokens';
import type { ReviewSplitResult } from '@/types/index';
import { Button, Spinner, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_STAMP } from '../constants';
import { DiffText } from '../modals';

interface ReviewSplitMessageProps {
  launching: boolean;
  result: ReviewSplitResult | null;
  onApprove: () => Promise<void>;
  onDiscard: () => Promise<void>;
}

const bubbleStyle = {
  background: 'rgba(0,0,0,0.05)',
  borderRadius: space[2],
  borderBottomLeftRadius: space[1],
  padding: `${space[3]} ${space[4]}`,
  alignSelf: 'flex-start' as const,
  maxWidth: '100%',
};

const pointHeading = (text: string) => (
  <p className="text-sm" style={{ margin: `0 0 ${space[2]}`, opacity: 0.7, fontStyle: 'italic' }}>
    "{text}"
  </p>
);

export const ReviewSplitMessage = ({
  launching,
  result,
  onApprove,
  onDiscard,
}: ReviewSplitMessageProps) => {
  const [discarding, setDiscarding] = useState(false);
  const [approving, setApproving] = useState(false);
  const busy = discarding || approving;

  if (!launching && !result) return null;

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: space[1],
        marginBottom: space[3],
      }}
    >
      <div className="text-sm" style={bubbleStyle}>
        {!result ? (
          <Spinner size="small" label="Splitting the review…" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: space[5] }}>
            <p style={{ margin: 0, opacity: 0.7 }}>
              Proposed split — approve to keep it, or discard to leave the review untouched.
            </p>
            {result.items.map((item, i) => (
              <div key={`${item.point}-${i}`}>
                {pointHeading(item.point)}
                <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                  <Stamp
                    size="small"
                    fillColor={
                      item.kind === 'rework' ? STATUS_STAMP.planned.fill : STATUS_STAMP.idea.fill
                    }
                    textColor={
                      item.kind === 'rework' ? STATUS_STAMP.planned.text : STATUS_STAMP.idea.text
                    }
                  >
                    {item.kind === 'rework' ? 'rework' : 'follow-up idea'}
                  </Stamp>
                </div>
                {item.kind === 'rework' && item.phases && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: space[2],
                      marginTop: space[2],
                    }}
                  >
                    {item.phases.map((phase, phaseIndex) => (
                      <div
                        key={`${phase.text}-${phaseIndex}`}
                        className="text-sm"
                        style={{ lineHeight: 1.5 }}
                      >
                        <DiffText tokens={diffWords('', phase.text)} />
                        {phase.description && (
                          <div style={{ opacity: 0.85, marginTop: space[1] }}>
                            <DiffText tokens={diffWords('', phase.description)} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {item.kind === 'idea' && item.followUp && (
                  <div style={{ marginTop: space[2] }}>
                    <p
                      className="text-sm"
                      style={{ margin: 0, fontFamily: fontFamily.serif, fontWeight: 600 }}
                    >
                      <DiffText tokens={diffWords('', item.followUp.title)} />
                    </p>
                    <p className="text-sm" style={{ margin: `${space[1]} 0 0`, lineHeight: 1.5 }}>
                      <DiffText tokens={diffWords('', item.followUp.body)} />
                    </p>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
              <Button variant="danger" size="small" onClick={handleDiscard} disabled={busy}>
                Discard
              </Button>
              <Button variant="primary" size="small" onClick={handleApprove} disabled={busy}>
                Approve
              </Button>
            </div>
          </div>
        )}
      </div>
      <span className="text-sm" style={{ fontWeight: 600, opacity: 0.45 }}>
        Agent
      </span>
    </div>
  );
};
