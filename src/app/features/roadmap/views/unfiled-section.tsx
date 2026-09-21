import type { PlanEntry } from '@/types/index';
import { Accordion, Stamp } from '@dendelion/paper-ui';
import { useState } from 'react';
import { IdeaRow } from './idea-row';

interface UnfiledSectionProps {
  entities: PlanEntry[];
  onOpenGraduated: (id: string | undefined, title: string) => void;
}

export const UnfiledSection = ({ entities, onOpenGraduated }: UnfiledSectionProps) => {
  const [expanded, setExpanded] = useState(false);
  const openEntities = entities.filter(
    (entity) => entity.status !== 'done' && entity.status !== 'dropped',
  );

  if (entities.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Accordion
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        title={
          <div className="flex items-center gap-2 px-1 pt-2">
            <span className="truncate font-handwritten text-md font-semibold leading-none opacity-70">
              Unfiled
            </span>
            <Stamp size="small" variant="warning">
              {entities.length} idea{entities.length === 1 ? '' : 's'} with no subject
            </Stamp>
          </div>
        }
      >
        <div className="flex flex-col gap-1 pb-2">
          {openEntities.map((entity) => (
            <IdeaRow
              key={entity.id ?? entity.title}
              idea={{
                id: entity.id ?? entity.title,
                title: entity.title,
                status: entity.status,
                pr: entity.pr,
                released: false,
              }}
              onOpen={() => onOpenGraduated(entity.id, entity.title)}
            />
          ))}
        </div>
      </Accordion>
    </div>
  );
};
