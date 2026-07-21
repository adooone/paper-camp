import { buildRoadmapPromotePrompt } from '@/app/features/plans/prompts';
import { useProjectSubjects } from '@/app/hooks/use-project-subjects';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { RoadmapItem } from '@/types/index';
import { Button, Modal, Select, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const NO_SUBJECT = '__no-subject__';

interface PromoteRoadmapItemModalProps {
  horizonTitle: string | null;
  item: RoadmapItem | null;
  onClose: () => void;
  onPromoted: () => void;
}

export const PromoteRoadmapItemModal = ({
  horizonTitle,
  item,
  onClose,
  onPromoted,
}: PromoteRoadmapItemModalProps) => {
  const promoteRoadmapItem = useAppStore((s) => s.promoteRoadmapItem);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const { subjects } = useProjectSubjects();
  const [subject, setSubject] = useState(NO_SUBJECT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      setSubject(NO_SUBJECT);
      setLoading(false);
      setError(null);
    }
  }, [item]);

  const handlePromote = async () => {
    if (!item || !horizonTitle) return;
    setLoading(true);
    setError(null);
    try {
      const id = await promoteRoadmapItem(
        horizonTitle,
        item,
        subject === NO_SUBJECT ? undefined : subject,
      );
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === id);
      if (idea) {
        try {
          await launchIdeaExtend(id, buildRoadmapPromotePrompt(idea, horizonTitle));
        } catch (err) {
          // The idea was created either way — a failed refine launch just means
          // no background research ran, not that the promotion itself failed.
          toast({
            title: 'Idea created, but the refine agent failed to launch',
            description: oneLineErrorSummary((err as Error).message),
            variant: 'error',
          });
        }
      }
      onPromoted();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={item !== null} onClose={onClose} title={item?.name ?? ''} size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <p style={{ margin: 0, opacity: 0.8 }}>{item?.description}</p>
        <div>
          <Select
            size="small"
            value={subject}
            onChange={setSubject}
            disabled={loading}
            options={[
              { value: NO_SUBJECT, label: 'No subject' },
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        {error && (
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handlePromote} disabled={loading}>
            {loading ? 'Promoting…' : 'Promote to idea'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
