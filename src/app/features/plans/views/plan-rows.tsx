import { fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Card, IconButton, Stamp } from '@dendelion/paper-ui';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';

interface PlanRowsProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
  /** FEAT-42: worklist-rows.tsx nests this under an idea-group header, which already
   * carries its own header row — set false there so it isn't repeated per group. */
  showHeader?: boolean;
}

const headerLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: 600,
  opacity: 0.6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

// Built from Cards, not paper-ui's Table, sharing the .plan-rows-grid column
// template (utilities.css) so the header and rows line up.
export const PlanRows = ({ plans, activePlanTitle, onOpen, showHeader = true }: PlanRowsProps) => {
  const gridClass = 'plan-rows-grid';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      {showHeader && (
        <Card size="small" texture="kraft" className="plan-row-card">
          <div className={gridClass}>
            <span style={headerLabelStyle}>Id</span>
            <span style={headerLabelStyle}>Title</span>
            <span className="plan-rows-cell-updated" style={headerLabelStyle}>
              Updated
            </span>
            <span style={headerLabelStyle}>Progress</span>
            <span style={headerLabelStyle}>Status</span>
          </div>
        </Card>
      )}
      {plans.map((plan) => {
        const progress = phaseProgress(plan);
        return (
          <div
            key={plan.title}
            role={onOpen ? 'button' : undefined}
            tabIndex={onOpen ? 0 : undefined}
            onClick={onOpen ? () => onOpen(plan.title) : undefined}
            onKeyDown={
              onOpen
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(plan.title);
                    }
                  }
                : undefined
            }
            className={plan.title === activePlanTitle ? 'plan-row-highlighted' : undefined}
            style={{ cursor: onOpen ? 'pointer' : undefined, borderRadius: 10 }}
          >
            <Card size="small" texture="canvas" className="plan-row-card">
              <div className={gridClass}>
                <PlanIdStamp id={plan.id} />
                <span
                  style={{
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {plan.title}
                </span>
                <span
                  className="plan-rows-cell-updated text-sm"
                  style={{ opacity: 0.45, whiteSpace: 'nowrap' }}
                >
                  {plan.updated ? relativeDate(plan.updated) : relativeDate(plan.created)}
                </span>
                {progress ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <ProgressBar pct={progress.pct} color={STATUS_COLOR[plan.status]} />
                    </div>
                    <span className="text-sm" style={{ opacity: 0.5, flexShrink: 0 }}>
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm" style={{ opacity: 0.3 }}>
                    —
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: space[1] }}>
                  <Stamp
                    size="small"
                    fillColor={STATUS_STAMP[plan.status].fill}
                    textColor={STATUS_STAMP[plan.status].text}
                  >
                    {STATUS_LABEL[plan.status]}
                  </Stamp>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
