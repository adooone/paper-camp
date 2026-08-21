import { PageTitle } from '@/app/components/page-title';
import { Breadcrumb, Card } from '@dendelion/paper-ui';
import { selectWorklistRows } from './helpers';
import { usePlansPage } from './hooks';
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
  const {
    plans,
    plansError,
    ideaEntries,
    suggestions,
    planFilters,
    activePlan,
    activeIdea,
    planId,
    ideaId,
    openSuggestion,
    setOpenSuggestion,
    handleBack,
    handleOpenPlan,
    handleOpenIdea,
    handleOpenArchivable,
    handleDismissSuggestion,
  } = usePlansPage();

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
          <PlansHeader showGroupingToggle={plans.entries.length > 0} />

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
              rows={rows}
              activePlanTitle={null}
              onOpenPlan={handleOpenPlan}
              onOpenIdea={handleOpenIdea}
            />
          )}

          <ArchiveSection onOpen={handleOpenArchivable} />

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
