import type { ResolvedRoadmapItem } from '@/types/index';
import { Accordion, Button, Stamp, type StampVariant } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';
import { HIGHLIGHT_OUTLINE_CLASS } from '../constants';
import { AddCandidateForm } from './add-candidate-form';
import { CandidateRow } from './candidate-row';
import { IdeaRow } from './idea-row';
import { RoughProgressBar } from './rough-progress-bar';

const ITEM_STATE_STAMP: Record<
  ResolvedRoadmapItem['state'],
  { variant: StampVariant; label: string }
> = {
  'not-started': { variant: 'neutral', label: 'Not started' },
  'in-progress': { variant: 'warning', label: 'In progress' },
  shipped: { variant: 'success', label: 'Shipped' },
};

const GRID_CLASS = 'grid flex-1 min-w-0 items-center gap-3 grid-cols-[minmax(0,1fr)_6rem_8rem]';

interface RoadmapItemRowProps {
  item: ResolvedRoadmapItem;
  highlighted: boolean;
  onPromote: () => void;
  onPromoteCandidate: (candidateName: string) => void;
  onAddCandidate: (name: string) => Promise<void>;
  onOpenGraduated: (id: string | undefined, title: string) => void;
}

export const RoadmapItemRow = ({
  item,
  highlighted,
  onPromote,
  onPromoteCandidate,
  onAddCandidate,
  onOpenGraduated,
}: RoadmapItemRowProps) => {
  const [expanded, setExpanded] = useState(highlighted);
  const stateStamp = ITEM_STATE_STAMP[item.state];

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);

  return (
    <div
      className={`border-b border-black/10 last:border-b-0 ${highlighted ? `roadmap-item-highlighted outline outline-2 outline-offset-[-2px] ${HIGHLIGHT_OUTLINE_CLASS}` : ''}`}
    >
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={
          <div className={GRID_CLASS}>
            <div className="min-w-0">
              <div className="truncate">{item.name}</div>
              <div className="truncate text-sm opacity-70">{item.description}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <Stamp size="small" variant={stateStamp.variant}>
                {stateStamp.label}
              </Stamp>
              {item.state === 'in-progress' && item.readyToShip && (
                <span className="font-handwritten text-2xs opacity-60 whitespace-nowrap">
                  ready to ship
                </span>
              )}
            </div>
            <div className="min-w-0">
              {item.rollup.total > 0 ? (
                <>
                  <div className="font-handwritten text-2xs opacity-70 whitespace-nowrap">
                    {item.rollup.done} of {item.rollup.total} · {item.rollup.open} open
                  </div>
                  <RoughProgressBar done={item.rollup.done} total={item.rollup.total} />
                </>
              ) : (
                <div className="font-handwritten text-2xs opacity-50">No ideas yet</div>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-1 pb-2">
          {item.ideas.map((idea) => (
            <IdeaRow
              key={idea.id}
              idea={idea}
              onOpen={() => onOpenGraduated(idea.id, idea.title)}
            />
          ))}
          {item.candidates.map((candidateName) => (
            <CandidateRow
              key={candidateName}
              name={candidateName}
              onPromote={() => onPromoteCandidate(candidateName)}
            />
          ))}
          <AddCandidateForm onAdd={onAddCandidate} />
          <Button
            type="button"
            variant="ghost"
            size="small"
            onClick={onPromote}
            className="self-start"
          >
            Promote to idea
          </Button>
        </div>
      </Accordion>
    </div>
  );
};
