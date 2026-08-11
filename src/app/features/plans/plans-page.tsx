import { PageTitle } from '@/app/components/page-title';
import { useActiveIdea, useActivePlan } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import type { SuggestionEntry } from '@/types/index';
import { Breadcrumb, Card, useToast } from '@dendelion/paper-ui';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
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
  const setDetailView = useAppStore((s) => s.setDetailView);
  const planFilters = useAppStore((s) => s.planFilters);
  const setSubjectFilter = useAppStore((s) => s.setSubjectFilter);
  const activePlan = useActivePlan();
  const activeIdea = useActiveIdea();
  const { planId, ideaId } = useParams({ strict: false });
  const dismissSuggestion = useAppStore((s) => s.dismissSuggestion);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subject: subjectParam } = useSearch({ strict: false }) as { subject?: string };

  useEffect(() => {
    setSubjectFilter(subjectParam ?? null);
  }, [subjectParam, setSubjectFilter]);

  // Opening a different plan/idea always lands on Details, never a stale Feedback view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the active entities are the reset trigger, not read in the body.
  useEffect(() => {
    setDetailView('details');
  }, [activePlan, activeIdea, setDetailView]);

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

  if (plansError) {
    return (
      <div>
        <PageTitle>Plans</PageTitle>
        <Card size="small" accent accentColor="rose">
          <p className="m-0 font-semibold">Couldn't load plans.md</p>
          <p className="m-0 opacity-75">{plansError}</p>
        </Card>
      </div>
    );
  }

  if (!plans) {
    // A direct reload/deep-link into a plan or idea route lands here too —
    // the worklist skeleton (table rows, search bar) reads as a mismatched
    // flash of the wrong page rather than a loading state for the detail
    // view about to render, so it's scoped to the actual worklist case.
    if (planId || ideaId) {
      return (
        <div>
          <output aria-live="polite" className="sr-only">
            Loading…
          </output>
          <p className="opacity-50">Loading…</p>
        </div>
      );
    }
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
          <EntityDetail plan={activePlan} />
        </div>
      ) : activeIdea ? (
        <div>
          <div className="mb-4">
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

          {plans.warnings.length > 0 && (
            <Card size="small" accent accentColor="amber">
              <p className="m-0 font-semibold">Some entries couldn't be parsed</p>
              <ul className="m-0 pl-5">
                {plans.warnings.map((w) => (
                  <li key={w.title}>
                    {w.title}: {w.message}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {plans.entries.length === 0 ? (
            <p className="opacity-50">
              No ideas yet — capture one with <strong>New idea</strong> above, or click{' '}
              <strong>Suggest ideas</strong> to have an agent propose some.
            </p>
          ) : (
            <ListView
              plans={plans.entries}
              rows={rows}
              activePlanTitle={null}
              onOpenPlan={handleOpenPlan}
              onOpenIdea={handleOpenIdea}
            />
          )}

          <ArchiveSection onOpenIdea={handleOpenIdea} />

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
