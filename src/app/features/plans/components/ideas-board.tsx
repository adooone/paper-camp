import { fontSize, space } from '@/app/styles/tokens';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';
import { DraftPlanButton } from './draft-plan-button';
import { PlanIdStamp } from './plan-id-stamp';

interface IdeasBoardProps {
  ideas: IdeaEntry[];
  plans: PlanEntry[];
  onOpenIdea?: (title: string) => void;
  onOpenPlan?: (title: string) => void;
}

const headerLabelStyle: React.CSSProperties = {
  fontSize: fontSize.xs,
  fontWeight: 600,
  opacity: 0.6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

/**
 * Same row-card style as plan-rows.tsx: a kraft header Card over one-line
 * canvas row Cards sharing the .idea-rows-grid template. "Draft plan" stays a
 * per-row action in the trailing column; ideas with linked plans get a toggle
 * there instead that expands the links below the row.
 */
export const IdeasBoard = ({ ideas, plans, onOpenIdea, onOpenPlan }: IdeasBoardProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (ideas.length === 0) return null;

  const linkedPlans = (ideaId: string) => plans.filter((p) => p.idea === ideaId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div className="idea-rows-grid">
          <span style={headerLabelStyle}>Id</span>
          <span style={headerLabelStyle}>Title</span>
          <span style={headerLabelStyle}>Status</span>
          <span style={headerLabelStyle} />
        </div>
      </Card>
      {ideas.map((idea) => {
        const status = idea.status ?? 'planned';
        const isExpanded = expanded === idea.title;
        const links = idea.id ? linkedPlans(idea.id) : [];
        const hasLinks = links.length > 0;
        return (
          <div key={idea.title} style={{ borderRadius: 10 }}>
            <Card size="small" texture="canvas" className="plan-row-card">
              <div className="idea-rows-grid">
                {/* Always occupy the first grid column — PlanIdStamp renders null when
                    id is absent, which would collapse the cell and shift every later
                    column left (same guard the action column below uses). */}
                {idea.id ? <PlanIdStamp id={idea.id} /> : <span />}
                <button
                  type="button"
                  onClick={() => onOpenIdea?.(idea.title)}
                  style={{
                    minWidth: 0,
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    textAlign: 'left',
                    font: 'inherit',
                    color: 'inherit',
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {idea.title}
                </button>
                <Stamp
                  size="small"
                  fillColor={STATUS_STAMP[status].fill}
                  textColor={STATUS_STAMP[status].text}
                >
                  {STATUS_LABEL[status]}
                </Stamp>
                {hasLinks ? (
                  <button
                    type="button"
                    aria-label={isExpanded ? 'Hide linked plans' : 'Show linked plans'}
                    onClick={() => setExpanded(isExpanded ? null : idea.title)}
                    style={{
                      justifySelf: 'start',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      opacity: 0.6,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      font: 'inherit',
                    }}
                  >
                    {isExpanded ? '▾' : '▸'} {links.length} plan{links.length === 1 ? '' : 's'}
                  </button>
                ) : idea.id ? (
                  <div style={{ justifySelf: 'start' }}>
                    <DraftPlanButton idea={idea} otherPlans={plans} />
                  </div>
                ) : (
                  <span />
                )}
              </div>
              {isExpanded && hasLinks && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: space[1],
                    marginTop: space[2],
                  }}
                >
                  {links.map((p) => (
                    <button
                      type="button"
                      key={p.title}
                      onClick={() => onOpenPlan?.(p.title)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        font: 'inherit',
                      }}
                    >
                      <Stamp size="small" fillColor="rgba(0,0,0,0.08)">
                        {p.id}
                      </Stamp>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
};
