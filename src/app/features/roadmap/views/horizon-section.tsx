import type { ResolvedRoadmapHorizon, ResolvedRoadmapItem } from '@/types/index';
import { RoadmapItemRow } from './roadmap-item-row';
import { ShippedFold } from './shipped-fold';

const rollupLine = (horizon: ResolvedRoadmapHorizon) => {
  const notStarted = horizon.items.filter((item) => item.state === 'not-started').length;
  return `${horizon.rollup.done} of ${horizon.rollup.total} ideas shipped · ${notStarted} item${notStarted === 1 ? '' : 's'} not started`;
};

interface HorizonSectionProps {
  horizon: ResolvedRoadmapHorizon;
  horizonTitles: string[];
  highlightedItem: string | undefined;
  onPromote: (item: ResolvedRoadmapItem, candidateName?: string) => void;
  onAddCandidate: (itemName: string, name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
  onEdit: (item: ResolvedRoadmapItem) => void;
  onMove: (item: ResolvedRoadmapItem, toHorizon: string) => void;
  onToggleShipped: (item: ResolvedRoadmapItem) => void;
  onRemove: (item: ResolvedRoadmapItem) => void;
  onRemoveCandidate: (item: ResolvedRoadmapItem, candidateName: string) => void;
}

export const HorizonSection = ({
  horizon,
  horizonTitles,
  highlightedItem,
  onPromote,
  onAddCandidate,
  onOpenGraduated,
  onEdit,
  onMove,
  onToggleShipped,
  onRemove,
  onRemoveCandidate,
}: HorizonSectionProps) => {
  const openItems = horizon.items.filter((item) => item.state !== 'shipped');
  const shippedItems = horizon.items.filter((item) => item.state === 'shipped');
  const otherHorizonTitles = horizonTitles.filter((title) => title !== horizon.title);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 px-1 pt-2">
        <div className="min-w-0">
          <div className="truncate font-handwritten text-md font-semibold leading-none opacity-70">
            {horizon.title}
          </div>
          {horizon.intro && <div className="truncate text-sm opacity-60">{horizon.intro}</div>}
        </div>
        <div className="shrink-0 whitespace-nowrap font-handwritten text-2xs opacity-60">
          {rollupLine(horizon)}
        </div>
      </div>
      {horizon.items.length === 0 ? (
        <div className="px-1 py-2 text-sm opacity-50">Nothing here matches</div>
      ) : (
        <div className="flex flex-col">
          {openItems.map((item) => (
            <RoadmapItemRow
              key={item.name}
              item={item}
              highlighted={item.name === highlightedItem}
              otherHorizonTitles={otherHorizonTitles}
              onPromote={() => onPromote(item)}
              onPromoteCandidate={(candidateName) => onPromote(item, candidateName)}
              onAddCandidate={(name) => onAddCandidate(item.name, name)}
              onOpenGraduated={onOpenGraduated}
              onEdit={() => onEdit(item)}
              onMove={(toHorizon) => onMove(item, toHorizon)}
              onToggleShipped={() => onToggleShipped(item)}
              onRemove={() => onRemove(item)}
              onRemoveCandidate={(candidateName) => onRemoveCandidate(item, candidateName)}
            />
          ))}
          <ShippedFold
            items={shippedItems}
            otherHorizonTitles={otherHorizonTitles}
            highlightedItem={highlightedItem}
            onPromote={onPromote}
            onAddCandidate={onAddCandidate}
            onOpenGraduated={onOpenGraduated}
            onEdit={onEdit}
            onMove={onMove}
            onToggleShipped={onToggleShipped}
            onRemove={onRemove}
            onRemoveCandidate={onRemoveCandidate}
          />
        </div>
      )}
    </div>
  );
};
