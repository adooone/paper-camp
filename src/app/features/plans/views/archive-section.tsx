import { useAppStore } from '@/app/stores/app-store';
import type { ArchivableIdea } from '@/types/index';
import { Button, MetaLine, Row, useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';
import { PlanIdStamp } from '../components';
import { PLAN_ROW_COLUMNS, RowMarker } from './plan-rows';

interface ArchiveSectionProps {
  /** Takes the entity, not its title: these are work entities whose id is already
   * known here, and a title round-trip resolves against the notes-only idea list. */
  onOpen?: (idea: ArchivableIdea) => void;
}

export const ArchiveSection = ({ onOpen }: ArchiveSectionProps) => {
  const archivableIdeas = useAppStore((s) => s.archivableIdeas);
  const archiveIdeas = useAppStore((s) => s.archiveIdeas);
  const search = useAppStore((s) => s.planFilters.search);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archivingAll, setArchivingAll] = useState(false);
  const { toast } = useToast();

  const needle = search.trim().toLowerCase();
  const visibleIdeas = needle
    ? archivableIdeas.filter((idea) => idea.title.toLowerCase().includes(needle))
    : archivableIdeas;

  const handleArchive = useCallback(
    async (ids: string[]) => {
      try {
        await archiveIdeas(ids);
      } catch (err) {
        toast({ title: 'Archive failed', description: (err as Error).message, variant: 'error' });
      }
    },
    [archiveIdeas, toast],
  );

  const handleArchiveOne = useCallback(
    async (idea: ArchivableIdea) => {
      setArchivingId(idea.id);
      try {
        await handleArchive([idea.id]);
      } finally {
        setArchivingId(null);
      }
    },
    [handleArchive],
  );

  const handleArchiveAll = useCallback(async () => {
    setArchivingAll(true);
    try {
      await handleArchive(visibleIdeas.map((idea) => idea.id));
    } finally {
      setArchivingAll(false);
    }
  }, [handleArchive, visibleIdeas]);

  if (visibleIdeas.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm m-0 opacity-60">Ready to archive ({visibleIdeas.length})</h2>
        <Button
          variant="ghost"
          size="small"
          disabled={archivingAll || archivingId !== null}
          onClick={handleArchiveAll}
        >
          {archivingAll ? 'Archiving…' : 'Archive all'}
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        {visibleIdeas.map((idea) => (
          <div key={idea.id} className="flex items-center">
            <RowMarker done />
            <div className="flex-1 min-w-0">
              <Row
                surface="nestedCard"
                columns={PLAN_ROW_COLUMNS}
                onClick={onOpen ? () => onOpen(idea) : undefined}
                ariaLabel={idea.title}
                id={<PlanIdStamp id={idea.id} />}
                title={idea.title}
                meta={<MetaLine>—</MetaLine>}
                trailing={
                  <Button
                    variant="ghost"
                    size="small"
                    className="archive-row-action"
                    disabled={archivingId === idea.id || archivingAll}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveOne(idea);
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {archivingId === idea.id ? 'Archiving…' : 'Archive'}
                  </Button>
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
