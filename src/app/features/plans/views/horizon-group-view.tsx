import { DoodleIllustration, RowSkeleton } from '@/app/components';
import {
  AddRoadmapItemModal,
  HorizonSection,
  PromoteRoadmapItemModal,
  RemoveRoadmapItemModal,
  type RoadmapPageState,
  StandingConcernsSection,
  UnfiledSection,
  firstSentence,
} from '@/app/features/roadmap';
import type { ResolvedRoadmapItem } from '@/types/index';
import { Divider, EmptyState } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';

interface HorizonGroupViewProps {
  roadmapPage: RoadmapPageState;
}

export const HorizonGroupView = ({ roadmapPage }: HorizonGroupViewProps) => {
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
  } = roadmapPage;

  const handleOpenItem = (item: ResolvedRoadmapItem) =>
    navigate({ to: '/roadmap/$item', params: { item: item.name } });

  if (roadmapError) {
    return (
      <p className="opacity-50">
        Couldn't load the roadmap — the server may need a restart to pick up new routes.
      </p>
    );
  }

  if (!roadmap) return <RowSkeleton />;

  if (roadmap.horizons.length === 0) {
    return (
      <EmptyState
        illustration={<DoodleIllustration name="empty-tray" />}
        message={
          <>
            No <code>ROADMAP.md</code> found at the project root.
          </>
        }
      />
    );
  }

  return (
    <div>
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
