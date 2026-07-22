import { MergeIcon } from '@/app/components/icons';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { PlanEntry } from '@/types/index';
import { Card, Spinner, Stamp, Tooltip } from '@dendelion/paper-ui';
import { PlanIdStamp } from '../components';
import { ProgressBar } from '../components';
import { PR_STATE_STAMP, STATUS_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { effectiveStatus, phaseProgress, relativeDate, runningTaskForPlan } from '../helpers';

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

export const ROW_MARKER_WIDTH = 36;

/** The gutter outside a row card: spinner while an agent works, run-order stamp, a check for done, or blank. */
export const RowMarker = ({
  order,
  done,
  running,
}: {
  order?: number;
  done?: boolean;
  running?: boolean;
}) => (
  <span
    style={{
      flex: `0 0 ${ROW_MARKER_WIDTH}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    {running ? (
      <Spinner size="small" label="Agent running" />
    ) : done ? (
      <span aria-label="Done" style={{ color: color.accentGreenDark, fontSize: fontSize.sm }}>
        ✓
      </span>
    ) : order !== undefined ? (
      <Stamp size="small" fillColor="rgba(0,0,0,0.06)">
        <span style={{ fontFamily: fontFamily.handwritten, fontSize: fontSize.xs, lineHeight: 1 }}>
          {order}
        </span>
      </Stamp>
    ) : null}
  </span>
);

// Built from Cards, not paper-ui's Table, sharing the .plan-rows-grid column
// template (utilities.css) so the header and rows line up.
export const PlanRows = ({ plans, activePlanTitle, onOpen, showHeader = true }: PlanRowsProps) => {
  const gridClass = 'plan-rows-grid';
  const agentStatus = useAppStore((s) => s.agentStatus);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
      {showHeader && (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: `0 0 ${ROW_MARKER_WIDTH}px` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
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
          </div>
        </div>
      )}
      {plans.map((plan) => {
        const progress = phaseProgress(plan);
        const status = effectiveStatus(plan, agentStatus);
        return (
          <div key={plan.title} style={{ display: 'flex', alignItems: 'center' }}>
            <RowMarker
              order={plan.order}
              done={plan.status === 'done'}
              running={Boolean(runningTaskForPlan(plan.id, agentStatus))}
            />
            <div
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
              style={{
                cursor: onOpen ? 'pointer' : undefined,
                borderRadius: 10,
                flex: 1,
                minWidth: 0,
              }}
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
                        <ProgressBar pct={progress.pct} color={STATUS_COLOR[status]} />
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
                      fillColor={STATUS_STAMP[status].fill}
                      textColor={STATUS_STAMP[status].text}
                    >
                      {STATUS_LABEL[status]}
                    </Stamp>
                    {plan.pr?.state === 'merged' && (
                      <Tooltip content={`Merged in #${plan.pr.number}`}>
                        <span style={{ display: 'inline-flex', color: PR_STATE_STAMP.merged.text }}>
                          <MergeIcon size={14} />
                        </span>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );
      })}
    </div>
  );
};
