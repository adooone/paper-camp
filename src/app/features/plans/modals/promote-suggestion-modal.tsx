import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts';
import { useAppStore } from '@/app/stores/app-store';
import { color, fontSize, space } from '@/app/styles/tokens';
import type { SuggestionEntry } from '@/types/index';
import { Button, Modal, useToast } from '@dendelion/paper-ui';
import { useEffect, useState } from 'react';

interface PromoteSuggestionModalProps {
  suggestion: SuggestionEntry | null;
  onClose: () => void;
}

/**
 * IDEA-62 phase 5: "Move to ideas" launches a two-step promotion — first the
 * mechanical part (mint an id, write the idea file, drop the line from
 * suggestions.md — see POST /api/suggestions/promote), then a normal
 * launch-extend agent run (buildSuggestionPromotePrompt) to flesh out the
 * one-liner. The second step reuses the idea id looked up from the store
 * right after promoteSuggestion's reload, same pattern ExtendIdeaButton uses.
 */
export const PromoteSuggestionModal = ({ suggestion, onClose }: PromoteSuggestionModalProps) => {
  const promoteSuggestion = useAppStore((s) => s.promoteSuggestion);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (suggestion) {
      setLoading(false);
      setError(null);
    }
  }, [suggestion]);

  const handleMoveToIdeas = async () => {
    if (!suggestion) return;
    setLoading(true);
    setError(null);
    try {
      const id = await promoteSuggestion(suggestion);
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === id);
      if (idea) {
        try {
          await launchIdeaExtend(id, buildSuggestionPromotePrompt(idea));
        } catch (err) {
          // The idea was created either way — a failed refine launch just means
          // no background research ran, not that the promotion itself failed.
          toast({
            title: 'Idea created, but the refine agent failed to launch',
            description: (err as Error).message,
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
      open={suggestion !== null}
      onClose={onClose}
      title={suggestion?.title ?? ''}
      size="small"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
        <p style={{ margin: 0, opacity: 0.8 }}>{suggestion?.description}</p>
        {error && (
          <p style={{ margin: 0, color: color.accentRoseDark, fontSize: fontSize.sm }}>{error}</p>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space[2] }}>
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
