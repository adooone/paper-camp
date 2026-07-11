import { PageTitle } from '@/app/components/page-title';
import { useActiveIdeaTitle, useActivePlanTitle } from '@/app/hooks';
import { deletePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Breadcrumb, Card } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { DeleteIdeaModal } from './components/delete-idea-modal';
import { EntityDetail } from './components/entity-detail';
import { FocusPlanHero } from './components/focus-plan-hero';
import { ListView } from './components/list-view';
import { NoteDetail } from './components/note-detail';
import { PlansHeader } from './components/plans-header';
import { PlansListSkeleton } from './components/plans-list-skeleton';
import { ReconcileQueueReview } from './components/reconcile-queue-review';
import { findFocusPlan } from './helpers';
import { selectWorklistRows } from './plan-list-selector';

export const PlansPage = () => {
  const { plans, plansError, ideaEntries, loadPlans, planFilters } = useAppStore();
  const activePlanTitle = useActivePlanTitle();
  const activeIdeaTitle = useActiveIdeaTitle();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate({ to: '/' });
  };

  const handleOpenPlan = (title: string) => {
    navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(title) } });
  };

  const handleOpenIdea = (title: string) => {
    navigate({ to: '/ideas/$ideaId', params: { ideaId: encodeURIComponent(title) } });
  };

  const [deleteIdeaTitle, setDeleteIdeaTitle] = useState<string | null>(null);

  const handleDeleteIdea = async (title: string) => {
    await deletePlan(title);
    await loadPlans();
    if (activePlanTitle === title) navigate({ to: '/' });
  };

  const activePlan = activePlanTitle
    ? plans?.entries.find((p) => p.title === activePlanTitle)
    : null;

  const activeIdea = activeIdeaTitle
    ? ideaEntries.find((idea) => idea.title === activeIdeaTitle)
    : null;

  if (plansError) {
    return (
      <div>
        <PageTitle>Plans</PageTitle>
        <Card size="small" accent accentColor="rose">
          <p style={{ margin: 0, fontWeight: 600 }}>Couldn't load plans.md</p>
          <p style={{ margin: 0, opacity: 0.75 }}>{plansError}</p>
        </Card>
      </div>
    );
  }

  if (!plans) {
    return (
      <div>
        <PlansHeader />
        {/* The skeleton is aria-hidden, so announce the loading state to AT here.
            <output> carries an implicit role="status". */}
        <output aria-live="polite" className="sr-only">
          Loading plans…
        </output>
        <PlansListSkeleton />
      </div>
    );
  }

  const focusPlan = findFocusPlan(plans.entries);
  const worklistEntries = focusPlan
    ? plans.entries.filter((p) => p.title !== focusPlan.title)
    : plans.entries;
  const { rows } = selectWorklistRows(worklistEntries, ideaEntries, planFilters);

  // The reconcile review queue is a self-contained modal driven by store state,
  // not by which branch is active — render it once above the branching so it
  // isn't duplicated across the plan/idea/list views.
  return (
    <>
      <ReconcileQueueReview />
      {activePlan ? (
        <div>
          <div style={{ marginBottom: space[4] }}>
            <Breadcrumb
              items={[
                { id: 'plans', label: 'Plans', onClick: handleBack },
                { id: 'plan', label: activePlan.title },
              ]}
            />
          </div>
          <EntityDetail plan={activePlan} />
        </div>
      ) : activeIdea ? (
        <div>
          <div style={{ marginBottom: space[4] }}>
            <Breadcrumb
              items={[
                { id: 'plans', label: 'Plans', onClick: handleBack },
                { id: 'idea', label: activeIdea.title },
              ]}
            />
          </div>
          <NoteDetail idea={activeIdea} />
        </div>
      ) : (
        <div>
          <PlansHeader />

          <FocusPlanHero plan={focusPlan} onOpenPlan={handleOpenPlan} />

          {plans.warnings.length > 0 && (
            <Card size="small" accent accentColor="amber">
              <p style={{ margin: 0, fontWeight: 600 }}>Some entries couldn't be parsed</p>
              <ul style={{ margin: 0, paddingLeft: space[5] }}>
                {plans.warnings.map((w) => (
                  <li key={w.title}>
                    {w.title}: {w.message}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {plans.entries.length === 0 ? (
            <p style={{ opacity: 0.5 }}>
              No plans yet. Run <code>paper-camp add plan &quot;name&quot;</code>, or add one to the
              backlog above.
            </p>
          ) : (
            <ListView
              plans={plans.entries}
              rows={rows}
              activePlanTitle={activePlanTitle}
              onOpenPlan={handleOpenPlan}
              onOpenIdea={handleOpenIdea}
              onDeleteIdea={setDeleteIdeaTitle}
            />
          )}

          <DeleteIdeaModal
            title={deleteIdeaTitle}
            onClose={() => setDeleteIdeaTitle(null)}
            onConfirm={handleDeleteIdea}
          />
        </div>
      )}
    </>
  );
};
