import { PageTitle } from '@/app/components/page-title';
import { useActiveIdeaTitle, useActivePlanTitle } from '@/app/hooks';
import { deletePlan } from '@/app/services/plans-api';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import { Breadcrumb, Card } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BoardView } from './components/board-view';
import { DeleteIdeaModal } from './components/delete-idea-modal';
import { EntityDetail } from './components/entity-detail';
import { ListView } from './components/list-view';
import { NoteDetail } from './components/note-detail';
import { PlansHeader } from './components/plans-header';
import { selectWorklistRows } from './plan-list-selector';

export const PlansPage = () => {
  const { plans, plansError, ideaEntries, view, loadPlans, planFilters } = useAppStore();
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
        <PageTitle>Plans</PageTitle>
        <p style={{ opacity: 0.5 }}>Loading…</p>
      </div>
    );
  }

  if (activePlan) {
    return (
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
    );
  }

  if (activeIdea) {
    return (
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
    );
  }

  const { rows } = selectWorklistRows(plans.entries, ideaEntries, planFilters);

  return (
    <div>
      <PlansHeader />

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
      ) : view === 'board' ? (
        <BoardView plans={plans.entries} />
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
  );
};
