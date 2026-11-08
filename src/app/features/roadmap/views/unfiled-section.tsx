import { PlanIdStamp } from '@/app/features/plans/components/plan-id-stamp';
import { STATUS_LABEL, STATUS_STAMP } from '@/app/features/plans/constants';
import type { RoadmapItemRef } from '@/types/index';
import { Accordion, Stamp } from '@dendelion/folk-ui';
import { useState } from 'react';

interface UnfiledSectionProps {
  entities: RoadmapItemRef[];
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
            <div
              key={entity.id}
              className="flex items-center gap-3 border-b border-black/10 py-1.5 last:border-b-0"
            >
              <PlanIdStamp id={entity.id} />
              <button
                type="button"
                onClick={() => onOpenGraduated(entity.id, entity.title)}
                className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-transparent border-none p-0 cursor-pointer [font:inherit] text-inherit text-left"
              >
                {entity.title}
              </button>
              <Stamp size="small" variant={STATUS_STAMP[entity.status]}>
                {STATUS_LABEL[entity.status]}
              </Stamp>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  );
};
