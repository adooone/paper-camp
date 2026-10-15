import { useAppStore } from '@/app/stores/app-store';
import type { ArchivableIdea } from '@/types/index';
import { Button, MetaLine, Row, useToast } from '@dendelion/folk-ui';
import { useCallback, useState } from 'react';
import { PlanIdStamp } from '../components';
import { PLAN_LIST_GRID, PLAN_ROW_COLUMNS, PLAN_ROW_HOST, RowIdCell, RowMarker } from './plan-rows';

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
      <div className={PLAN_LIST_GRID}>
        {visibleIdeas.map((idea) => (
          <div key={idea.id} className={PLAN_ROW_HOST}>
            <Row
              surface="nestedCard"
              columns={PLAN_ROW_COLUMNS}
              onClick={onOpen ? () => onOpen(idea) : undefined}
              ariaLabel={idea.title}
              id={<RowIdCell marker={<RowMarker done />} id={<PlanIdStamp id={idea.id} fill />} />}
              title={idea.title}
              meta={<MetaLine>—</MetaLine>}
              trailing={
                <Button
                  variant="ghost"
                  size="small"
                  className="archive-row-action ml-auto"
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
        ))}
      </div>
    </div>
  );
};
