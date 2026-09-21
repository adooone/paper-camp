import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { RoadmapItemRow } from './roadmap-item-row';

interface ShippedFoldProps {
  items: ResolvedRoadmapItem[];
  otherHorizonTitles: string[];
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

export const ShippedFold = ({
  items,
  otherHorizonTitles,
  highlightedItem,
  onPromote,
  onAddCandidate,
  onOpenGraduated,
  onEdit,
  onMove,
  onToggleShipped,
  onRemove,
  onRemoveCandidate,
}: ShippedFoldProps) => {
  const containsHighlighted = items.some((item) => item.name === highlightedItem);
  const [expanded, setExpanded] = useState(containsHighlighted);

  useEffect(() => {
    if (containsHighlighted) setExpanded(true);
  }, [containsHighlighted]);

  if (items.length === 0) return null;

  return (
    <Accordion
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      title={
        <div className="min-w-0">
          <div>
            Shipped · {items.length} item{items.length === 1 ? '' : 's'}
          </div>
          <div className="truncate text-sm opacity-70">
            {items.map((item) => item.name).join(', ')}
          </div>
        </div>
      }
    >
      <div className="flex flex-col">
        {items.map((item) => (
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
      </div>
    </Accordion>
  );
};
