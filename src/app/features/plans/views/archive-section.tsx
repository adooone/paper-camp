import { useAppStore } from '@/app/stores/app-store';
import type { ArchivableIdea } from '@/types/index';
import { Button, Card, useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';
import { PlanIdStamp } from '../components';
import { PLAN_ROWS_GRID_CLASS, RowMarker } from './plan-rows';

interface ArchiveSectionProps {
  /** Takes the entity, not its title: these are work entities whose id is already
   * known here, and a title round-trip resolves against the notes-only idea list. */
  onOpen?: (idea: ArchivableIdea) => void;
}

export const ArchiveSection = ({ onOpen }: ArchiveSectionProps) => {
  const archivableIdeas = useAppStore((s) => s.archivableIdeas);
  const archiveIdeas = useAppStore((s) => s.archiveIdeas);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archivingAll, setArchivingAll] = useState(false);
  const { toast } = useToast();

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
      await handleArchive(archivableIdeas.map((idea) => idea.id));
    } finally {
      setArchivingAll(false);
    }
  }, [handleArchive, archivableIdeas]);

  if (archivableIdeas.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm m-0 opacity-60">Ready to archive ({archivableIdeas.length})</h2>
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
        {archivableIdeas.map((idea) => (
          <div key={idea.id} className="flex items-center">
            <RowMarker done />
            <div
              role={onOpen ? 'button' : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onClick={onOpen ? () => onOpen(idea) : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(idea);
                      }
                    }
                  : undefined
              }
              className={`${onOpen ? 'cursor-pointer' : ''} rounded-[10px] flex-1 min-w-0`}
            >
              <Card size="small" texture="canvas" shade className="plan-row-card">
                <div className={PLAN_ROWS_GRID_CLASS}>
                  <PlanIdStamp id={idea.id} />
                  <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {idea.title}
                  </span>
                  <span className="max-lg:hidden text-sm opacity-30">—</span>
                  <span className="text-sm opacity-30">—</span>
                  <Button
                    variant="ghost"
                    size="small"
                    disabled={archivingId === idea.id || archivingAll}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchiveOne(idea);
                    }}
                  >
                    {archivingId === idea.id ? 'Archiving…' : 'Archive'}
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
