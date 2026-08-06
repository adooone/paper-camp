import { useAppStore } from '@/app/stores/app-store';
import type { ArchivableIdea } from '@/types/index';
import { Button, Card, useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';
import { PlanIdStamp } from '../components';

interface ArchiveSectionProps {
  onOpenIdea?: (title: string) => void;
}

export const ArchiveSection = ({ onOpenIdea }: ArchiveSectionProps) => {
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
          <div key={idea.id} className="rounded-[10px]">
            <Card size="small" texture="canvas" className="plan-row-card">
              <div className="flex items-center gap-2">
                <div
                  role={onOpenIdea ? 'button' : undefined}
                  tabIndex={onOpenIdea ? 0 : undefined}
                  onClick={onOpenIdea ? () => onOpenIdea(idea.title) : undefined}
                  onKeyDown={
                    onOpenIdea
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenIdea(idea.title);
                          }
                        }
                      : undefined
                  }
                  className={`flex items-center gap-2 flex-1 min-w-0 ${onOpenIdea ? 'cursor-pointer' : ''}`}
                >
                  <PlanIdStamp id={idea.id} />
                  <span className="font-semibold overflow-hidden text-ellipsis whitespace-nowrap">
                    {idea.title}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="small"
                  disabled={archivingId === idea.id || archivingAll}
                  onClick={() => handleArchiveOne(idea)}
                >
                  {archivingId === idea.id ? 'Archiving…' : 'Archive'}
                </Button>
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
