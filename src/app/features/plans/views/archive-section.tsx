import { useAppStore } from '@/app/stores/app-store';
import { space } from '@/app/styles/tokens';
import type { ArchivableIdea } from '@/types/index';
import { Button, Card, IconButton, useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';
import { PlanIdStamp } from '../components';

export const ArchiveSection = () => {
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
    <div style={{ marginTop: space[5] }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[2],
          margin: `0 0 ${space[2]}`,
        }}
      >
        <h2 className="text-sm" style={{ margin: 0, opacity: 0.6 }}>
          Ready to archive ({archivableIdeas.length})
        </h2>
        <Button
          variant="ghost"
          size="small"
          disabled={archivingAll || archivingId !== null}
          onClick={handleArchiveAll}
        >
          {archivingAll ? 'Archiving…' : 'Archive all'}
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[1] }}>
        {archivableIdeas.map((idea) => (
          <div key={idea.id} style={{ borderRadius: 10 }}>
            <Card size="small" texture="canvas" className="plan-row-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
                <PlanIdStamp id={idea.id} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {idea.title}
                </span>
                <IconButton
                  icon={<span>&rarr;</span>}
                  variant="ghost"
                  size="small"
                  label={`Archive ${idea.title}`}
                  disabled={archivingId === idea.id || archivingAll}
                  onClick={() => handleArchiveOne(idea)}
                  style={{ width: 28, height: 28 }}
                />
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
