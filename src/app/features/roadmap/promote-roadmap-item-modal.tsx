import { buildRoadmapPromotePrompt } from '@/app/features/plans/prompts';
import { useSubjectVocabulary } from '@/app/hooks/use-subject-vocabulary';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { RoadmapItem } from '@/types/index';
import { Button, Modal, Select, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

const NO_SUBJECT = '__no-subject__';

interface PromoteRoadmapItemModalProps {
  horizonTitle: string | null;
  item: RoadmapItem | null;
  candidateName?: string | null;
  onClose: () => void;
  onPromoted: () => void;
}

export const PromoteRoadmapItemModal = ({
  horizonTitle,
  item,
  candidateName,
  onClose,
  onPromoted,
}: PromoteRoadmapItemModalProps) => {
  const promoteRoadmapItem = useAppStore((s) => s.promoteRoadmapItem);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const { subjects, available: subjectsAvailable } = useSubjectVocabulary();
  const [subject, setSubject] = useState(NO_SUBJECT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (item) {
      // A candidate defaults to its parent item's name — the "big bet becomes a
      // Subject" rule — but the picker still lets the user override it.
      setSubject(candidateName ? item.name : NO_SUBJECT);
      setLoading(false);
      setError(null);
    }
  }, [item, candidateName]);

  const handlePromote = async () => {
    if (!item || !horizonTitle) return;
    setLoading(true);
    setError(null);
    try {
      const id = await promoteRoadmapItem(
        horizonTitle,
        item,
        subject === NO_SUBJECT ? undefined : subject,
        candidateName ?? undefined,
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
    <Modal
      open={item !== null}
      onClose={onClose}
      title={candidateName ?? item?.name ?? ''}
      size="small"
    >
      <div className="flex flex-col gap-4">
        {!candidateName && <p className="m-0 opacity-80">{item?.description}</p>}
        <div>
          <Select
            size="small"
            value={subject}
            onChange={setSubject}
            disabled={loading || !subjectsAvailable}
            options={[
              { value: NO_SUBJECT, label: 'No subject' },
              ...(!subjectsAvailable && subject !== NO_SUBJECT
                ? [{ value: subject, label: subject }]
                : []),
              ...subjects.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
        {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
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
