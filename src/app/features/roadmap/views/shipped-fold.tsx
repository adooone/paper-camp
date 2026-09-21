import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { RoadmapItemRow } from './roadmap-item-row';

interface ShippedFoldProps {
  items: ResolvedRoadmapItem[];
  highlightedItem: string | undefined;
  onPromote: (item: ResolvedRoadmapItem, candidateName?: string) => void;
  onAddCandidate: (itemName: string, name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
}

export const ShippedFold = ({
  items,
  highlightedItem,
  onPromote,
  onAddCandidate,
  onOpenGraduated,
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
            onPromote={() => onPromote(item)}
            onPromoteCandidate={(candidateName) => onPromote(item, candidateName)}
            onAddCandidate={(name) => onAddCandidate(item.name, name)}
            onOpenGraduated={onOpenGraduated}
          />
        ))}
      </div>
    </Accordion>
  );
};
