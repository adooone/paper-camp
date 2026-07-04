import { space } from '@/app/styles/tokens';
import type { PlanStatus } from '@/types/index';
import { Card, Stamp } from '@dendelion/paper-ui';
import { STATUS_LABEL, STATUS_STAMP } from '../constants';

interface PlanFilterCardProps {
  statusCounts: Record<PlanStatus, number>;
  activeStatuses: PlanStatus[];
  onToggleStatus: (status: PlanStatus) => void;
}

/** Chip order follows the selector's default sort precedence, not PLAN_STATUSES' declaration order. */
const STATUS_CHIP_ORDER: PlanStatus[] = [
  'in-progress',
  'review',
  'planned',
  'idea',
  'done',
  'dropped',
];

/** "Backlog" here, not STATUS_LABEL's "Idea" — matches this list's own terminology (add-to-backlog-button.tsx) for idea-status plans, distinct from the Ideas page. */
const STATUS_CHIP_LABEL: Record<PlanStatus, string> = {
  ...STATUS_LABEL,
  idea: 'Backlog',
};

/**
 * Sticky kraft Card pinned below the app header (position: sticky within the
 * page's scroll container, so it reads as pinned under the fixed app header
 * above it). Status chips double as filters and live counts; done/dropped
 * default off per FEAT-41's first-paint guard, so a plain click brings them in.
 */
export const PlanFilterCard = ({
  statusCounts,
  activeStatuses,
  onToggleStatus,
}: PlanFilterCardProps) => {
  const active = new Set(activeStatuses);
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, marginBottom: space[4] }}>
      <Card size="small" texture="kraft" className="plan-row-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], alignItems: 'center' }}>
          {STATUS_CHIP_ORDER.map((status) => {
            const isActive = active.has(status);
            return (
              <button
                key={status}
                type="button"
                onClick={() => onToggleStatus(status)}
                aria-pressed={isActive}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                <Stamp
                  size="small"
                  fillColor={STATUS_STAMP[status].fill}
                  textColor={STATUS_STAMP[status].text}
                >
                  {STATUS_CHIP_LABEL[status]} {statusCounts[status]}
                </Stamp>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
