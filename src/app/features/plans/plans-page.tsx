import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { useRoadmapPage } from '@/app/features/roadmap';
import { ProjectChip, useScope } from '@/app/features/scope';
import { Card, EmptyState, PageTitle } from '@dendelion/paper-ui';
import { selectWorklistRows, sortWorklistRows } from './helpers';
import { usePlansPage, useScopeRoadmaps, useScopeWorklist } from './hooks';
import { PromoteSuggestionModal } from './modals';
import {
  ArchiveSection,
  ChunkDetail,
  EntityDetail,
  ForeignHorizonSection,
  HorizonGroupView,
  ListView,
  NightReportSection,
  NoteDetail,
  PlansHeader,
  PlansListSkeleton,
  PlansToolbar,
  ReconcileQueueReview,
  SuggestionsSection,
} from './views';

export const PlansPage = () => {
  const {
    plans,
    plansError,
    ideaEntries,
    suggestions,
    nightReport,
    planFilters,
    activePlan,
    activeIdea,
    activeChunk,
    planId,
    ideaId,
    chunk,
    group,
    handleGroupChange,
    openSuggestion,
    setOpenSuggestion,
    handleBack,
    handleOpenPlan,
    handleOpenIdea,
    handleOpenArchivable,
    handleOpenNightChunk,
    handleDismissSuggestion,
  } = usePlansPage();
  const roadmapPage = useRoadmapPage();

  const scope = useScope(null);
  const scopeRows = scope.groups.flatMap((g) => g.rows).filter((r) => r.checked);
  const multiProject = scopeRows.length > 1;
  const currentScopeRow = scopeRows.find((r) => r.isCurrent);
  const otherScopeProjects = multiProject ? scopeRows.filter((r) => !r.isCurrent) : [];
  const otherRows = useScopeWorklist(otherScopeProjects, planFilters);
  const otherRoadmaps = useScopeRoadmaps(otherScopeProjects);

  if (plansError) {
    return (
      <div>
        <PageTitle className="mb-6">Plans</PageTitle>
        <Card size="small" accent accentColor="rose">
          <p className="m-0 font-semibold">Couldn't load plans.md</p>
          <p className="m-0 opacity-75">{plansError}</p>
        </Card>
      </div>
    );
  }

  if (!plans) {
    // A direct reload/deep-link into a plan, idea, finding, or chunk route lands here too —
    // the worklist skeleton would flash as the wrong page instead of the detail view's own state.
    if (planId || ideaId || chunk) {
      return (
        <div>
          <RowSkeleton />
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

  const { rows: ownRows } = selectWorklistRows(plans.entries, ideaEntries, planFilters);
  const rows = multiProject
    ? sortWorklistRows(
        [
          ...(currentScopeRow ? ownRows.map((r) => ({ ...r, project: currentScopeRow })) : ownRows),
          ...otherRows,
        ],
        planFilters.sortKey,
        planFilters.sortDirection,
      )
    : ownRows;

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
          <NoteDetail idea={activeIdea} />
        </div>
      ) : activeChunk ? (
        <div>
          <ChunkDetail chunk={activeChunk} />
        </div>
      ) : (
        <div>
          <PlansHeader
            group={group}
            canAddItem={roadmapPage.horizonTitles.length > 0}
            onAddItem={() => roadmapPage.setAddOpen(true)}
          />
          <PlansToolbar entries={plans.entries} group={group} onGroupChange={handleGroupChange} />

          {group === 'horizon' ? (
            <>
              {multiProject && currentScopeRow && (
                <div className="mb-3">
                  <ProjectChip project={currentScopeRow} />
                </div>
              )}
              <HorizonGroupView roadmapPage={roadmapPage} />
              {multiProject &&
                otherRoadmaps.map((entry) => (
                  <ForeignHorizonSection
                    key={entry.project.key}
                    entry={entry}
                    onOpenCrossProject={scope.openRow}
                  />
                ))}
            </>
          ) : (
            <>
              <NightReportSection groups={nightReport} onOpenChunk={handleOpenNightChunk} />

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

              {(multiProject ? rows.length === 0 : plans.entries.length === 0) ? (
                <EmptyState
                  illustration={<DoodleIllustration name="empty-tray" />}
                  message={
                    <>
                      No ideas yet — capture one with <strong>New idea</strong> above, or click{' '}
                      <strong>Suggest ideas</strong> to have an agent propose some.
                    </>
                  }
                />
              ) : (
                <ListView
                  rows={rows}
                  activePlanTitle={null}
                  onOpenPlan={handleOpenPlan}
                  onOpenIdea={handleOpenIdea}
                  onOpenCrossProject={scope.openRow}
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
            </>
          )}
        </div>
      )}
    </>
  );
};
