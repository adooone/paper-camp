import { PageTitle } from '@/app/components/page-title';
import { useActiveIdeaTitle, useActivePlanTitle } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import type { SuggestionEntry } from '@/types/index';
import { Breadcrumb, Card, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { selectWorklistRows } from './helpers';
import { PromoteSuggestionModal } from './modals';
import { ReconcileQueueReview } from './views';
import { EntityDetail } from './views';
import { NoteDetail } from './views';
import {
  ArchiveSection,
  ListView,
  PlansHeader,
  PlansListSkeleton,
  SuggestionsSection,
} from './views';

export const PlansPage = () => {
  const plans = useAppStore((s) => s.plans);
  const plansError = useAppStore((s) => s.plansError);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const suggestions = useAppStore((s) => s.suggestions);
  const loadPlans = useAppStore((s) => s.loadPlans);
  const planFilters = useAppStore((s) => s.planFilters);
  const activePlanTitle = useActivePlanTitle();
  const activeIdeaTitle = useActiveIdeaTitle();
  const dismissSuggestion = useAppStore((s) => s.dismissSuggestion);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleBack = () => {
    navigate({ to: '/' });
  };

  const handleOpenPlan = (title: string) => {
    navigate({ to: '/plans/$planId', params: { planId: encodeURIComponent(title) } });
  };

  const handleOpenIdea = (title: string) => {
    navigate({ to: '/ideas/$ideaId', params: { ideaId: encodeURIComponent(title) } });
  };

  const [openSuggestion, setOpenSuggestion] = useState<SuggestionEntry | null>(null);

  const handleDismissSuggestion = async (suggestion: SuggestionEntry) => {
    try {
      await dismissSuggestion(suggestion);
    } catch (err) {
      toast({
        title: 'Failed to dismiss suggestion',
        description: (err as Error).message,
        variant: 'error',
      });
    }
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
        <PageTitle>Ideas</PageTitle>
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
        {/* Skeleton is aria-hidden; <output>'s implicit role="status" announces this instead. */}
        <output aria-live="polite" className="sr-only">
          Loading plans…
        </output>
        <PlansListSkeleton />
      </div>
    );
  }

  const { rows } = selectWorklistRows(plans.entries, ideaEntries, planFilters);

  // Driven by store state, not by which branch is active — render once above the
  // branching so it isn't duplicated across the plan/idea/list views.
  return (
    <>
      <ReconcileQueueReview />
      {activePlan ? (
        <div>
          <div style={{ marginBottom: space[4] }}>
            <Breadcrumb
              items={[
                { id: 'plans', label: 'Ideas', onClick: handleBack },
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
                { id: 'plans', label: 'Ideas', onClick: handleBack },
                { id: 'idea', label: activeIdea.title },
              ]}
            />
          </div>
          <NoteDetail idea={activeIdea} />
        </div>
      ) : (
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
          ) : (
            <ListView
              plans={plans.entries}
              rows={rows}
              activePlanTitle={activePlanTitle}
              onOpenPlan={handleOpenPlan}
              onOpenIdea={handleOpenIdea}
            />
          )}

          <ArchiveSection />

          <SuggestionsSection
            suggestions={suggestions}
            onOpen={setOpenSuggestion}
            onDismiss={handleDismissSuggestion}
          />

          <PromoteSuggestionModal
            suggestion={openSuggestion}
            onClose={() => setOpenSuggestion(null)}
          />
        </div>
      )}
    </>
  );
};
