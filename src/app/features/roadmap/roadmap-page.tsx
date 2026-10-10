import { RowSkeleton } from '@/app/components';
import { PageTitle } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useRoadmapItemPage, useRoadmapPage } from './hooks';
import { AddRoadmapItemModal, PromoteRoadmapItemModal, RemoveRoadmapItemModal } from './modals';
import { RoadmapItemPage } from './views';

export const RoadmapPage = () => {
  const navigate = useNavigate();
  const { item, horizonTitle, dateRange } = useRoadmapItemPage();
  const {
    roadmap,
    roadmapError,
    loadRoadmap,
    horizonTitles,
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

  if (!item) {
    return (
      <div>
        <PageTitle className="mb-6">Roadmap</PageTitle>
        <p className="opacity-50">Couldn't find that roadmap item.</p>
      </div>
    );
  }

  return (
    <>
      <RoadmapItemPage
        item={item}
        horizonTitle={horizonTitle}
        dateRange={dateRange}
        otherHorizonTitles={horizonTitles.filter((title) => title !== horizonTitle)}
        onOpenGraduated={onOpenGraduated}
        onAddCandidate={(name) => handleAddCandidate(horizonTitle ?? '', item.name, name)}
        onPromoteCandidate={(candidateName) =>
          handlePromote(horizonTitle ?? '', item, candidateName)
        }
        onRemoveCandidate={(candidateName) =>
          handleRemoveCandidate(horizonTitle ?? '', item, candidateName)
        }
        onEdit={() => handleEdit(horizonTitle ?? '', item)}
        onMove={(toHorizon) => handleMove(horizonTitle ?? '', item, toHorizon)}
        onToggleShipped={() => handleToggleShipped(horizonTitle ?? '', item)}
        onRemove={() => handleRemoveItem(horizonTitle ?? '', item)}
        onPromote={() => handlePromote(horizonTitle ?? '', item)}
      />
      <PromoteRoadmapItemModal
        horizonTitle={promoting?.horizonTitle ?? null}
        item={promoting?.item ?? null}
        candidateName={promoting?.candidateName}
        onClose={() => setPromoting(null)}
        onPromoted={loadRoadmap}
      />
      <AddRoadmapItemModal
        open={editing !== null}
        horizonTitles={horizonTitles}
        editing={editing}
        onClose={() => setEditing(null)}
      />
      <RemoveRoadmapItemModal
        horizonTitle={removing?.horizonTitle ?? null}
        item={removing?.item ?? null}
        onClose={() => setRemoving(null)}
        onRemoved={() => navigate({ to: '/', search: { group: 'horizon' } })}
      />
    </>
  );
};
