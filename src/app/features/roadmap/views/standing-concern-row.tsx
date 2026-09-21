import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion } from '@dendelion/paper-ui';
import { useState } from 'react';
import { IdeaRow } from './idea-row';

interface StandingConcernRowProps {
  item: ResolvedRoadmapItem;
  onOpen: (id: string | undefined, title: string) => void;
}

const GRID_CLASS = 'grid flex-1 min-w-0 items-center gap-3 grid-cols-[minmax(0,1fr)_6rem_8rem]';

export const StandingConcernRow = ({ item, onOpen }: StandingConcernRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const openIdeas = item.ideas.filter(
    (idea) => idea.status !== 'done' && idea.status !== 'dropped',
  );

  return (
    <div className="border-b border-black/10 last:border-b-0">
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={
          <div className={GRID_CLASS}>
            <div className="min-w-0">
              <div className="truncate">{item.name}</div>
              <div className="truncate text-sm opacity-70">{item.description}</div>
            </div>
            <div />
            <div className="min-w-0 whitespace-nowrap font-handwritten text-2xs opacity-70">
              {item.rollup.done} shipped · {item.rollup.open} open
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-1 pb-2">
          {openIdeas.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} onOpen={() => onOpen(idea.id, idea.title)} />
          ))}
        </div>
      </Accordion>
    </div>
  );
};
