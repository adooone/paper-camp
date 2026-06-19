import { PageTitle } from '@/app/components/page-title';
import { updatePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import type { PhaseItem, PlanEntry } from '@/types/index';
import { Alert, Button, Progress, Stamp } from '@dendelion/paper-ui';
import { useMemo, useState } from 'react';
import { STATUS_LABEL, STATUS_STAMP } from '../plans/constants';
import { phaseProgress, relativeDate } from '../plans/helpers';
import { FocusPhaseItem } from './components/focus-phase-item';

const findFocusPlan = (
  plans: PlanEntry[] | undefined,
  activePlanTitle: string | null,
): PlanEntry | undefined => {
  if (!plans) return undefined;
  if (activePlanTitle) {
    const selected = plans.find((p) => p.title === activePlanTitle);
    if (selected) return selected;
  }
  return plans.find((p) => p.status === 'in-progress');
};

export const FocusPage = () => {
  const { plans, plansError, activePlanTitle, loadPlans } = useAppStore();
  const [updating, setUpdating] = useState(false);

  const plan = useMemo(
    () => findFocusPlan(plans?.entries, activePlanTitle),
    [plans?.entries, activePlanTitle],
  );

  const progress = plan ? phaseProgress(plan) : null;

  const handleTogglePhase = async (index: number) => {
    if (!plan) return;
    const nextPhases: PhaseItem[] = plan.phases.map((phase, i) =>
      i === index ? { ...phase, done: !phase.done } : phase,
    );
    setUpdating(true);
    await updatePlan(plan.title, { phases: nextPhases });
    await loadPlans();
    setUpdating(false);
  };

  const handleMarkDone = async () => {
    if (!plan) return;
    setUpdating(true);
    await updatePlan(plan.title, { status: 'done' });
    await loadPlans();
    setUpdating(false);
  };

  const handleStart = async () => {
    if (!plan) return;
    setUpdating(true);
    await updatePlan(plan.title, { status: 'in-progress' });
    await loadPlans();
    setUpdating(false);
  };

  const handleStop = async () => {
    if (!plan) return;
    setUpdating(true);
    await updatePlan(plan.title, { status: 'planned' });
    await loadPlans();
    setUpdating(false);
  };

  if (plansError) {
    return (
      <div>
        <PageTitle>Focus</PageTitle>
        <Alert variant="error" title="Couldn't load plans.md">
          {plansError}
        </Alert>
      </div>
    );
  }

  if (!plans) {
    return (
      <div>
        <PageTitle>Focus</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div>
        <PageTitle>Focus</PageTitle>
        <Alert variant="warning" title="Nothing to focus on">
          Select a plan from the sidebar, or mark a plan as in-progress in plans.md.
        </Alert>
      </div>
    );
  }

  const allDone = progress !== null && progress.done === progress.total && progress.total > 0;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <PageTitle>Focus</PageTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Stamp
            size="small"
            fillColor={STATUS_STAMP[plan.status].fill}
            textColor={STATUS_STAMP[plan.status].text}
          >
            {STATUS_LABEL[plan.status]}
          </Stamp>
          <Button
            variant="primary"
            size="small"
            className={plan.status === 'in-progress' ? 'btn-orange' : 'btn-green'}
            onClick={plan.status === 'in-progress' ? handleStop : handleStart}
            disabled={updating}
          >
            {plan.status === 'in-progress' ? 'Stop' : 'Start'}
          </Button>
        </div>
      </div>

      <h2
        className="text-2xl"
        style={{
          fontFamily: 'Luminari, "Cormorant Garamond", Georgia, serif',
          fontWeight: 600,
          margin: '0 0 0.75rem',
          lineHeight: 1.2,
        }}
      >
        {plan.title}
      </h2>

      <p className="text-sm" style={{ opacity: 0.5, margin: '0 0 2rem' }}>
        {plan.updated
          ? `updated ${relativeDate(plan.updated)}`
          : `created ${relativeDate(plan.created)}`}
      </p>

      {plan.body && (
        <p
          className="text-base"
          style={{
            fontFamily: '"Cormorant Garamond", Georgia, serif',
            lineHeight: 1.55,
            margin: '0 0 2.5rem',
            opacity: 0.85,
          }}
        >
          {plan.body}
        </p>
      )}

      {progress !== null && (
        <div style={{ marginBottom: '2rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}
          >
            <span className="text-xs" style={{ opacity: 0.6, fontWeight: 600 }}>
              Progress
            </span>
            <span className="text-xs" style={{ opacity: 0.6 }}>
              {progress.done} / {progress.total}
            </span>
          </div>
          <Progress value={progress.pct} color="#C89A5A" height={10} />
        </div>
      )}

      {plan.phases.length > 0 && (
        <div style={{ marginBottom: '2.5rem' }}>
          <h3
            className="text-xs"
            style={{
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              opacity: 0.4,
              margin: '0 0 0.75rem',
            }}
          >
            Phases
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {plan.phases.map((phase, index) => (
              <FocusPhaseItem
                key={`${phase.text}-${index}`}
                phase={phase}
                planTitle={plan.title}
                phaseIndex={index}
                onToggle={() => handleTogglePhase(index)}
              />
            ))}
          </div>
        </div>
      )}

      {allDone && plan.status !== 'done' && (
        <Button
          variant="primary"
          className="btn-violet"
          onClick={handleMarkDone}
          disabled={updating}
        >
          Mark complete
        </Button>
      )}
    </div>
  );
};
