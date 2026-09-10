import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { NightSuggestionEntry } from '@/types/index';
import { Button, Modal, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface PromoteNightFindingModalProps {
  finding: NightSuggestionEntry | null;
  onClose: () => void;
}

function nightFindingTitle(finding: NightSuggestionEntry): string {
  const base = finding.file.split('/').pop() ?? finding.file;
  return `${finding.check}: ${base}`;
}

export const PromoteNightFindingModal = ({ finding, onClose }: PromoteNightFindingModalProps) => {
  const promoteNightFinding = useAppStore((s) => s.promoteNightFinding);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (finding) {
      setLoading(false);
      setError(null);
    }
  }, [finding]);

  const handleMoveToIdeas = async () => {
    if (!finding) return;
    setLoading(true);
    setError(null);
    try {
      const id = await promoteNightFinding(finding);
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === id);
      if (idea) {
        try {
          await launchIdeaExtend(id, buildSuggestionPromotePrompt(idea));
        } catch (err) {
          toast({
            title: 'Idea created, but the refine agent failed to launch',
            description: oneLineErrorSummary((err as Error).message),
            variant: 'error',
          });
        }
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={finding !== null}
      onClose={onClose}
      title={finding ? nightFindingTitle(finding) : ''}
      size="small"
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 opacity-80">{finding?.message}</p>
        {finding && (
          <p className="m-0 opacity-50 text-2xs">
            {finding.file}
            {finding.line ? `:${finding.line}` : ''} · {finding.chunk} · commit{' '}
            {finding.commit.slice(0, 7)}
          </p>
        )}
        {error && <p className="m-0 text-watercolor-rose-dark text-sm">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={handleMoveToIdeas} disabled={loading}>
            {loading ? 'Moving…' : 'Move to ideas'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
