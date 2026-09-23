import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion, MetaLine, Row } from '@dendelion/paper-ui';
import { useState } from 'react';
import { IdeaRow } from './idea-row';

interface StandingConcernRowProps {
  item: ResolvedRoadmapItem;
  onOpen: (id: string | undefined, title: string) => void;
}

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
          <Row
            surface="none"
            columns={{ id: '0px', title: 'minmax(0,1fr)', meta: '0px', trailing: '8rem' }}
            id=""
            title={
              <div className="min-w-0">
                <div className="truncate">{item.name}</div>
                <div className="line-clamp-2 text-sm opacity-70 sm:line-clamp-1">
                  {item.description}
                </div>
              </div>
            }
            meta=""
            trailing={
              <MetaLine className="whitespace-nowrap">
                {item.rollup.done} shipped · {item.rollup.open} open
              </MetaLine>
            }
          />
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
