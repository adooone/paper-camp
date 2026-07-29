import { searchDecisions } from '@/app/features/plans/helpers';
import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { DecisionEntry } from '@/types/index';
import { Input, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { ViewDecisionModal } from '../view-decision-modal';
import { deskChalk, deskTextMuted, sectionLabelStyle } from './shared';

export const DecisionSearchSection = () => {
  const decisions = useAppStore((s) => s.decisions);
  const [query, setQuery] = useState('');
  const [viewingDecision, setViewingDecision] = useState<DecisionEntry | null>(null);

  const results = searchDecisions(decisions, query);

  return (
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: `0 ${space[6]} ${space[6]}`,
      }}
    >
      <div style={sectionLabelStyle}>Decisions</div>
      <Input
        surface="chalkboard"
        size="small"
        aria-label="Search decisions"
        placeholder="Search decisions…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() && (
        <div
          style={{
            marginTop: space[2],
            display: 'flex',
            flexDirection: 'column',
            gap: space[2],
          }}
        >
          {results.length === 0 ? (
            <span style={{ fontSize: fontSize['2xs'], color: deskTextMuted }}>
              No decisions match "{query}".
            </span>
          ) : (
            results.map((decision) => (
              <button
                key={decision.title}
                type="button"
                onClick={() => setViewingDecision(decision)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[2],
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                  textAlign: 'left',
                  color: deskChalk,
                }}
              >
                <Stamp
                  surface="chalkboard"
                  size="small"
                  variant={decision.status === 'superseded' ? 'warning' : 'success'}
                >
                  {decision.status}
                </Stamp>
                <span
                  style={{
                    fontFamily: fontFamily.mono,
                    fontSize: fontSize['2xs'],
                    textDecoration: 'underline',
                  }}
                >
                  {decision.title}
                </span>
              </button>
            ))
          )}
        </div>
      )}
      <ViewDecisionModal decision={viewingDecision} onClose={() => setViewingDecision(null)} />
    </div>
  );
};
