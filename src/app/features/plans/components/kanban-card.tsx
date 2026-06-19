import type { PlanEntry } from '@/types/index';
import { Stamp } from '@dendelion/paper-ui';
import { STATUS_BAR_COLOR } from '../constants';
import { phaseProgress } from '../helpers';
import { ProgressBar } from './progress-bar';

interface KanbanCardProps {
  plan: PlanEntry;
}

export const KanbanCard = ({ plan }: KanbanCardProps) => {
  const progress = phaseProgress(plan);
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.6)',
        border: '1px solid rgba(0,0,0,0.1)',
        borderRadius: 6,
        padding: '0.65rem 0.75rem',
        cursor: 'default',
      }}
    >
      <div className="text-sm" style={{ fontWeight: 500, lineHeight: 1.3, marginBottom: '0.4rem' }}>
        {plan.title}
      </div>
      {plan.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          {plan.tags.map((t) => (
            <Stamp key={t} size="small" fillColor="rgba(0,0,0,0.06)">
              {t}
            </Stamp>
          ))}
        </div>
      )}
      {progress !== null && (
        <div>
          <ProgressBar pct={progress.pct} color={STATUS_BAR_COLOR[plan.status]} height={4} />
          <span
            className="text-xs"
            style={{ opacity: 0.45, marginTop: '0.2rem', display: 'block' }}
          >
            {progress.done}/{progress.total}
          </span>
        </div>
      )}
    </div>
  );
};
