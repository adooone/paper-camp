import { EmptyState } from '@/app/components';
import { EmptyTrayIllustration } from '@/app/components/empty-state-illustrations';
import { PageTitle } from '@/app/components/page-title';
import { useRoadmapPage } from './hooks';
import { PromoteRoadmapItemModal } from './modals';
import { GoalBanner, HorizonSection } from './views';

export const RoadmapPage = () => {
  const {
    roadmap,
    roadmapError,
    loadRoadmap,
    horizons,
    totalVisible,
    hasActiveFilters,
    highlightedItem,
    containerRef,
    promoting,
    setPromoting,
    graduatedByItem,
    handleAddCandidate,
    handlePromote,
    onOpenGraduated,
  } = useRoadmapPage();

  if (roadmapError) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p className="opacity-50">
          Couldn't load the roadmap — the server may need a restart to pick up new routes.
        </p>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <p className="opacity-50">Loading…</p>
      </div>
    );
  }

  if (roadmap.horizons.length === 0) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <EmptyState
          illustration={<EmptyTrayIllustration />}
          message={
            <>
              No <code>ROADMAP.md</code> found at the project root.
            </>
          }
        />
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <PageTitle>Roadmap</PageTitle>
      <GoalBanner goal={roadmap.goal} />
      {totalVisible === 0 ? (
        <EmptyState
          illustration={<EmptyTrayIllustration />}
          message={
            hasActiveFilters
              ? 'Nothing matches these filters — clear one from the sidebar to see more.'
              : 'No roadmap items yet — add one from the sidebar.'
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {horizons
            .filter((horizon) => horizon.items.length > 0)
            .map((horizon) => (
              <HorizonSection
                key={horizon.title}
                horizon={horizon}
                highlightedItem={highlightedItem}
                graduatedByItem={graduatedByItem}
                onPromote={(item, candidateName) =>
                  handlePromote(horizon.title, item, candidateName)
                }
                onAddCandidate={(itemName, name) =>
                  handleAddCandidate(horizon.title, itemName, name)
                }
                onOpenGraduated={onOpenGraduated}
              />
            ))}
        </div>
      )}
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        candidateName={promoting?.candidateName}
        onClose={() => setPromoting(null)}
        onPromoted={loadRoadmap}
      />
    </div>
  );
};
