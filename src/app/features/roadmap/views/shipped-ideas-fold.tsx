import type { ResolvedIdea } from '@/types/index';
import { Accordion } from '@dendelion/paper-ui';
import { useState } from 'react';
import { IdeaRow } from './idea-row';

interface ShippedIdeasFoldProps {
  ideas: ResolvedIdea[];
  onOpen: (id: string | undefined, title: string) => void;
}

export const ShippedIdeasFold = ({ ideas, onOpen }: ShippedIdeasFoldProps) => {
  const [expanded, setExpanded] = useState(false);

  if (ideas.length === 0) return null;

  return (
    <div className="pc-nested-fold">
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={`${ideas.length} shipped`}
      >
        <div className="flex flex-col">
          {ideas.map((idea) => (
            <IdeaRow key={idea.id} idea={idea} onOpen={() => onOpen(idea.id, idea.title)} />
          ))}
        </div>
      </Accordion>
    </div>
  );
};
