import { EmptyState, RowSkeleton } from '@/app/components';
import { PageTitle } from '@/app/components/page-title';
import { Button, Divider } from '@dendelion/paper-ui';
import { useRoadmapPage } from './hooks';
import { AddRoadmapItemModal, PromoteRoadmapItemModal } from './modals';
import { GoalBanner, HorizonSection } from './views';

export const RoadmapPage = () => {
  const {
    roadmap,
    roadmapError,
    loadRoadmap,
    horizons,
    totalVisible,
    hasActiveFilters,
    horizonTitles,
    addOpen,
    setAddOpen,
    highlightedItem,
    containerRef,
    promoting,
    setPromoting,
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
        <RowSkeleton />
      </div>
    );
  }

  if (roadmap.horizons.length === 0) {
    return (
      <div>
        <PageTitle>Roadmap</PageTitle>
        <EmptyState
          illustration="empty-tray"
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
      <div className="mb-2 flex flex-nowrap items-center gap-3">
        <PageTitle className="mb-0 shrink-0">Roadmap</PageTitle>
        <div className="flex-1" />
        <Button
          type="button"
          variant="primary"
          size="small"
          onClick={() => setAddOpen(true)}
          disabled={horizonTitles.length === 0}
        >
          + Add item
        </Button>
      </div>
      <GoalBanner goal={roadmap.goal} />
      {totalVisible === 0 ? (
        <EmptyState
          illustration="empty-tray"
          message={
            hasActiveFilters
              ? 'Nothing matches these filters — clear one from the sidebar to see more.'
              : 'No roadmap items yet — add one from the sidebar.'
          }
        />
      ) : (
        <div className="flex flex-col">
          {horizons
            .filter((horizon) => horizon.items.length > 0)
            .map((horizon, index) => (
              <div key={horizon.title}>
                {index > 0 && <Divider sketch className="my-6" />}
                <HorizonSection
                  horizon={horizon}
                  highlightedItem={highlightedItem}
                  onPromote={(item, candidateName) =>
                    handlePromote(horizon.title, item, candidateName)
                  }
                  onAddCandidate={(itemName, name) =>
                    handleAddCandidate(horizon.title, itemName, name)
                  }
                  onOpenGraduated={onOpenGraduated}
                />
              </div>
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
      <AddRoadmapItemModal
        open={addOpen}
        horizonTitles={horizonTitles}
        onClose={() => setAddOpen(false)}
      />
    </div>
  );
};
