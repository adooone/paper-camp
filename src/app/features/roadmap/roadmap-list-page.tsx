import { DoodleIllustration, PageToolbar, PageToolbarRow, RowSkeleton } from '@/app/components';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Button, Divider, EmptyState, Input, PageTitle } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { firstSentence } from './helpers';
import { useRoadmapPage, useRoadmapSidebar } from './hooks';
import { AddRoadmapItemModal, PromoteRoadmapItemModal, RemoveRoadmapItemModal } from './modals';
import { HorizonSection, StandingConcernsSection, UnfiledSection } from './views';

export const RoadmapListPage = () => {
  const navigate = useNavigate();
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
    editing,
    setEditing,
    promoting,
    setPromoting,
    removing,
    setRemoving,
    onOpenGraduated,
  } = useRoadmapPage();
  const { filters, setRoadmapSearch } = useRoadmapSidebar();

  const handleOpenItem = (item: ResolvedRoadmapItem) =>
    navigate({ to: '/project/roadmap/$item', params: { item: item.name } });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <PageTitle className="flex-1 m-0">Roadmap</PageTitle>
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

      <PageToolbar>
        <PageToolbarRow>
          <Input
            type="search"
            size="small"
            placeholder="Search roadmap…"
            aria-label="Search roadmap"
            value={filters.search}
            onChange={(event) => setRoadmapSearch(event.target.value)}
            className="min-w-[140px] flex-1"
          />
        </PageToolbarRow>
      </PageToolbar>

      {roadmapError ? (
        <p className="opacity-50">
          Couldn't load the roadmap — the server may need a restart to pick up new routes.
        </p>
      ) : !roadmap ? (
        <RowSkeleton />
      ) : roadmap.horizons.length === 0 ? (
        <EmptyState
          illustration={<DoodleIllustration name="empty-tray" />}
          message={
            <>
              No <code>ROADMAP.md</code> found at the project root.
            </>
          }
        />
      ) : (
        <>
          <p className="mb-6 truncate text-sm opacity-60">{firstSentence(roadmap.goal)}</p>
          {totalVisible === 0 && !hasActiveFilters ? (
            <EmptyState
              illustration={<DoodleIllustration name="empty-tray" />}
              message="No roadmap items yet — add one from the toolbar."
            />
          ) : (
            <div className="flex flex-col">
              {horizons.map((horizon, index) => (
                <div key={horizon.title}>
                  {index > 0 && <Divider sketch className="my-6" />}
                  <HorizonSection horizon={horizon} onOpen={handleOpenItem} />
                </div>
              ))}
            </div>
          )}
          {roadmap.standingConcerns.length > 0 && (
            <>
              <Divider sketch className="my-6" />
              <StandingConcernsSection items={roadmap.standingConcerns} onOpen={handleOpenItem} />
            </>
          )}
          {roadmap.unfiled.length > 0 && (
            <>
              <Divider sketch className="my-6" />
              <UnfiledSection entities={roadmap.unfiled} onOpenGraduated={onOpenGraduated} />
            </>
          )}
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
