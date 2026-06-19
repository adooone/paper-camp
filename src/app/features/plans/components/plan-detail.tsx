import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import type { PlanEntry } from '@/types/index';
import { Button, Checkbox, Stamp } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { STATUS_BAR_COLOR, STATUS_LABEL, STATUS_STAMP } from '../constants';
import { phaseProgress, relativeDate } from '../helpers';
import { ProgressBar } from './progress-bar';

interface PlanDetailProps {
  plan: PlanEntry;
}

export const PlanDetail = ({ plan }: PlanDetailProps) => {
  const navigate = useNavigate();
  const loadPlans = useAppStore((s) => s.loadPlans);
  const [updating, setUpdating] = useState(false);
  const progress = phaseProgress(plan);
  const inProgress = plan.status === 'in-progress';

  const handleStart = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'in-progress' });
    await loadPlans();
    setUpdating(false);
    navigate({ to: '/focus' });
  };

  const handleStop = async () => {
    setUpdating(true);
    await updatePlan(plan.title, { status: 'planned' });
    await loadPlans();
    setUpdating(false);
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.75rem',
        }}
      >
        <h2
          style={{
            fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
            fontWeight: 600,
            fontSize: '1.75rem',
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {plan.title}
        </h2>
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

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <Stamp
          size="small"
          fillColor={STATUS_STAMP[plan.status].fill}
          textColor={STATUS_STAMP[plan.status].text}
        >
          {STATUS_LABEL[plan.status]}
        </Stamp>
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
        <p className="text-base" style={{ margin: '0 0 1rem', opacity: 0.8, lineHeight: 1.5 }}>
          {plan.body}
        </p>
      )}

      {progress !== null && (
        <div style={{ marginBottom: '1.25rem' }}>
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

      {plan.phases.length > 0 && (
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          {plan.phases.map((phase, i) => (
            <li key={`${phase.text}-${i}`}>
              <div className="flex items-center gap-3">
                <Checkbox checked={phase.done} disabled />
                <span
                  className={`text-base ${phase.done ? 'line-through' : ''}`}
                  style={{
                    fontFamily: '"Cormorant Garamond", Georgia, serif',
                    lineHeight: 1.4,
                    opacity: phase.done ? 0.65 : 1,
                  }}
                >
                  {phase.text}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
