import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { IdeaEntry } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { buildIdeaExtendPrompt } from '../prompts';

interface ExtendIdeaButtonProps {
  idea: IdeaEntry;
  /** worklist-rows.tsx's trailing actions column is too narrow for the full label. */
  compact?: boolean;
}

/**
 * Shared by idea-detail.tsx and worklist-rows.tsx's idea-group parent row — looks
 * up the idea fresh from the store at click-time (not the possibly-stale `idea`
 * prop) so a second Extend after the first one's Log entry landed still works.
 */
export const ExtendIdeaButton = ({ idea, compact }: ExtendIdeaButtonProps) => {
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const { state, errorMessage, run } = useActionFeedback();
  const { toast } = useToast();
  const ideaId = idea.id;

  const handleClick = () => {
    if (!ideaId) return;
    run(async () => {
      const latest = useAppStore.getState().ideaEntries.find((e) => e.id === ideaId);
      // Throw, don't return: a bare return resolves the run() callback normally, so
      // useActionFeedback would flash success even though the extend never launched.
      if (!latest) throw new Error(`Idea ${ideaId} not found`);
      try {
        await launchIdeaExtend(ideaId, buildIdeaExtendPrompt(latest));
      } catch (err) {
        toast({
          title: 'Extension failed',
          description: (err as Error).message,
          variant: 'error',
        });
        throw err;
      }
    });
  };

  const label =
    state === 'loading'
      ? 'Extending…'
      : state === 'success'
        ? compact
          ? 'Sent!'
          : 'Extension sent!'
        : state === 'error'
          ? 'Extension failed'
          : compact
            ? 'Extend'
            : 'Extend with AI';

  const title =
    state === 'error'
      ? (errorMessage ?? 'Extension failed')
      : ideaId
        ? undefined
        : 'Idea needs an ID before an agent can run';

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={state === 'loading' || !ideaId}
        style={{ color: state === 'error' ? color.accentRoseDark : undefined }}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
