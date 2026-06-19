import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Card, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { STATUS_ACCENT, STATUS_BAR_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';
import { ProgressBar } from './progress-bar';

interface PlanCardProps {
  plan: PlanEntry;
  highlighted?: boolean;
  onOpen?: (title: string) => void;
}

export const PlanCard = ({ plan, highlighted, onOpen }: PlanCardProps) => {
  const navigate = useNavigate();
  const loadPlans = useAppStore((s) => s.loadPlans);
  const [updating, setUpdating] = useState(false);
  const progress = phaseProgress(plan);
  const inProgress = plan.status === 'in-progress';

  const handleStart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdating(true);
    await updatePlan(plan.title, { status: 'in-progress' });
    await loadPlans();
    setUpdating(false);
    navigate({ to: '/focus' });
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdating(true);
    await updatePlan(plan.title, { status: 'planned' });
    await loadPlans();
    setUpdating(false);
  };

  return (
    <div
      style={
        highlighted
          ? { outline: '2px solid rgba(200,154,90,0.5)', outlineOffset: 2, borderRadius: 4 }
          : undefined
      }
    >
      <Card texture="white" accent accentColor={STATUS_ACCENT[plan.status]}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <h2 className="text-lg" style={{ margin: 0, lineHeight: 1.3 }}>
            {plan.title}
          </h2>
          <Stamp
            size="small"
            fillColor={STATUS_STAMP[plan.status].fill}
            textColor={STATUS_STAMP[plan.status].text}
          >
            {STATUS_LABEL[plan.status]}
          </Stamp>
        </div>

        <div
          style={{
            marginTop: '0.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span className="text-sm" style={{ opacity: 0.45 }}>
            {plan.updated
              ? `updated ${relativeDate(plan.updated)}`
              : `created ${relativeDate(plan.created)}`}
          </span>
          {plan.tags.map((tag) => (
            <Stamp key={tag} size="small" fillColor="rgba(0,0,0,0.06)">
              {tag}
            </Stamp>
          ))}
        </div>

        {plan.body && (
          <p className="text-base" style={{ margin: '0.6rem 0 0', opacity: 0.8, lineHeight: 1.5 }}>
            {plan.body}
          </p>
        )}

        {progress !== null && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <ProgressBar pct={progress.pct} color={STATUS_BAR_COLOR[plan.status]} />
              </div>
              <span className="text-sm" style={{ opacity: 0.5, flexShrink: 0 }}>
                {progress.done}/{progress.total}
              </span>
            </div>
          </div>
        )}

        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          {onOpen && (
            <Button
              variant="primary"
              size="small"
              className="btn-blue"
              onClick={() => onOpen(plan.title)}
            >
              Open
            </Button>
          )}
          <Button
            variant="primary"
            size="small"
            className={inProgress ? 'btn-orange' : 'btn-green'}
            onClick={inProgress ? handleStop : handleStart}
            disabled={updating}
          >
            {inProgress ? 'Stop' : 'Start'}
          </Button>
        </div>
      </Card>
    </div>
  );
};
