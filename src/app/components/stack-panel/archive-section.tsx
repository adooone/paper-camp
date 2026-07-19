import { useAppStore } from '@/app/stores/app-store';
import { fontFamily, fontSize, space } from '@/app/styles/tokens';
import type { ArchivableIdea } from '@/types/index';
import { Button, Card, IconButton, useToast } from '@dendelion/paper-ui';
import { useCallback, useState } from 'react';
import { deskChalk, deskTextMuted, sectionLabelStyle } from './shared';

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
        toast({
          title: 'Archive failed',
          description: (err as Error).message,
          variant: 'error',
        });
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
    <div
      style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: space[6],
      }}
    >
      <div style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: space[2] }}>
        Archive
        <span style={{ color: deskTextMuted, fontWeight: 400, fontSize: fontSize.sm }}>
          {archivableIdeas.length} ready
        </span>
      </div>
      <Card surface="chalkboard" size="small" className="stack-card-fill">
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
          {archivableIdeas.map((idea) => (
            <div
              key={idea.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[2],
                fontFamily: fontFamily.mono,
                fontSize: fontSize['2xs'],
                color: deskChalk,
              }}
            >
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {idea.id} — {idea.title}
              </span>
              <IconButton
                icon={<span style={{ fontSize: fontSize['2xs'] }}>&rarr;</span>}
                surface="chalkboard"
                size="small"
                label={`Archive ${idea.title}`}
                disabled={archivingId === idea.id || archivingAll}
                onClick={() => handleArchiveOne(idea)}
              />
            </div>
          ))}
        </div>
        <Button
          surface="chalkboard"
          size="small"
          fullWidth
          disabled={archivingAll || archivingId !== null}
          onClick={handleArchiveAll}
          style={{ marginTop: space[3] }}
        >
          {archivingAll ? 'Archiving…' : `Archive all ${archivableIdeas.length}`}
        </Button>
      </Card>
    </div>
  );
};
