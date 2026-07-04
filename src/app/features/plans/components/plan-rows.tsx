import { fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Card, IconButton, Stamp } from '@dendelion/paper-ui';
import { STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';
import { PlanIdStamp } from './plan-id-stamp';
import { ProgressBar } from './progress-bar';

interface PlanRowsProps {
  plans: PlanEntry[];
  activePlanTitle?: string | null;
  onOpen?: (title: string) => void;
  /** Backlog-only: deletes a plan still in "idea" status. Adds a trailing column. */
  onDeleteIdea?: (title: string) => void;
}

const headerLabelStyle: React.CSSProperties = {
  fontSize: fontSize.sm,
  fontWeight: 600,
  opacity: 0.6,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

/**
 * A table-shaped list built from Cards, not paper-ui's Table: a kraft header
 * card over compact one-line paper rows, all sharing the .plan-rows-grid
 * column template (utilities.css) so the columns line up. Rows are read-only —
 * the title owns the space, status is a Stamp, and any editing (including
 * status changes) happens inside the plan the row opens.
 */
export const PlanRows = ({ plans, activePlanTitle, onOpen, onDeleteIdea }: PlanRowsProps) => {
  const gridClass = onDeleteIdea ? 'plan-rows-grid plan-rows-grid--deletable' : 'plan-rows-grid';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div className={gridClass}>
          <span style={headerLabelStyle}>Id</span>
          <span style={headerLabelStyle}>Title</span>
          <span className="plan-rows-cell-updated" style={headerLabelStyle}>
            Updated
          </span>
          <span style={headerLabelStyle}>Progress</span>
          <span style={headerLabelStyle}>Status</span>
          {onDeleteIdea && <span style={headerLabelStyle} />}
        </div>
      </Card>
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
                <Stamp
                  size="small"
                  fillColor={STATUS_STAMP[plan.status].fill}
                  textColor={STATUS_STAMP[plan.status].text}
                >
                  {STATUS_LABEL[plan.status]}
                </Stamp>
                {onDeleteIdea &&
                  (plan.status === 'idea' ? (
                    <IconButton
                      icon={<span>×</span>}
                      variant="ghost"
                      size="small"
                      label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteIdea(plan.title);
                      }}
                      onKeyDown={(e) => {
                        // Keep Enter/Space from bubbling to the row's onKeyDown — otherwise
                        // one keypress both deletes the plan and opens its detail view.
                        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
                      }}
                    />
                  ) : (
                    <span />
                  ))}
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
};
