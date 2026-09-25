import { DoodleIllustration, RowSkeleton } from '@/app/components';
import { Button, Divider, EmptyState, PageTitle } from '@dendelion/paper-ui';
import { firstSentence } from './helpers';
import { useRoadmapPage } from './hooks';
import { AddRoadmapItemModal, PromoteRoadmapItemModal, RemoveRoadmapItemModal } from './modals';
import { HorizonSection, StandingConcernsSection, UnfiledSection } from './views';

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
    editing,
    setEditing,
    removing,
    setRemoving,
    handleAddCandidate,
    handlePromote,
    handleEdit,
    handleMove,
    handleToggleShipped,
    handleRemoveItem,
    handleRemoveCandidate,
    onOpenGraduated,
  } = useRoadmapPage();

  if (roadmapError) {
    return (
      <div>
        <PageTitle className="mb-6">Roadmap</PageTitle>
        <p className="opacity-50">
          Couldn't load the roadmap — the server may need a restart to pick up new routes.
        </p>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div>
        <PageTitle className="mb-6">Roadmap</PageTitle>
        <RowSkeleton />
      </div>
    );
  }

  if (roadmap.horizons.length === 0) {
    return (
      <div>
        <PageTitle className="mb-6">Roadmap</PageTitle>
        <EmptyState
          illustration={<DoodleIllustration name="empty-tray" />}
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
      <p className="mb-6 truncate text-sm opacity-60">{firstSentence(roadmap.goal)}</p>
      {totalVisible === 0 && !hasActiveFilters ? (
        <EmptyState
          illustration={<DoodleIllustration name="empty-tray" />}
          message="No roadmap items yet — add one from the sidebar."
        />
      ) : (
        <div className="flex flex-col">
          {horizons.map((horizon, index) => (
            <div key={horizon.title}>
              {index > 0 && <Divider sketch className="my-6" />}
              <HorizonSection
                horizon={horizon}
                horizonTitles={horizonTitles}
                highlightedItem={highlightedItem}
                onPromote={(item, candidateName) =>
                  handlePromote(horizon.title, item, candidateName)
                }
                onAddCandidate={(itemName, name) =>
                  handleAddCandidate(horizon.title, itemName, name)
                }
                onOpenGraduated={onOpenGraduated}
                onEdit={(item) => handleEdit(horizon.title, item)}
                onMove={(item, toHorizon) => handleMove(horizon.title, item, toHorizon)}
                onToggleShipped={(item) => handleToggleShipped(horizon.title, item)}
                onRemove={(item) => handleRemoveItem(horizon.title, item)}
                onRemoveCandidate={(item, candidateName) =>
                  handleRemoveCandidate(horizon.title, item, candidateName)
                }
              />
            </div>
          ))}
        </div>
      )}
      {roadmap.standingConcerns.length > 0 && (
        <>
          <Divider sketch className="my-6" />
          <StandingConcernsSection
            items={roadmap.standingConcerns}
            onOpenGraduated={onOpenGraduated}
          />
        </>
      )}
      {roadmap.unfiled.length > 0 && (
        <>
          <Divider sketch className="my-6" />
          <UnfiledSection entities={roadmap.unfiled} onOpenGraduated={onOpenGraduated} />
        </>
      )}
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        candidateName={promoting?.candidateName}
        onClose={() => setPromoting(null)}
        onPromoted={loadRoadmap}
      />
      <AddRoadmapItemModal
        open={addOpen || editing !== null}
        horizonTitles={horizonTitles}
        editing={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
      />
      <RemoveRoadmapItemModal
        horizonTitle={removing?.horizonTitle ?? null}
        item={removing?.item ?? null}
        onClose={() => setRemoving(null)}
      />
    </div>
  );
};
