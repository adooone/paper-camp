import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { buildPlanDraftPrompt } from '../prompts';

interface DraftPlanButtonProps {
  idea: IdeaEntry;
  otherPlans: PlanEntry[];
}

export const DraftPlanButton = ({ idea, otherPlans }: DraftPlanButtonProps) => {
  const launchPlanDraft = useAppStore((s) => s.launchPlanDraft);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { state, errorMessage, run } = useActionFeedback();
  const { toast } = useToast();

  const handleClick = () => {
    const id = idea.id;
    if (!id) return;
    run(async () => {
      try {
        await launchPlanDraft(id, buildPlanDraftPrompt(idea, otherPlans));
      } catch (err) {
        toast({
          title: 'Draft failed',
          description: oneLineErrorSummary((err as Error).message),
          variant: 'error',
        });
        throw err;
      }
    });
  };

  const label =
    state === 'loading'
      ? 'Drafting…'
      : state === 'success'
        ? 'Draft sent!'
        : state === 'error'
          ? 'Draft failed'
          : 'Draft plan';
  // Surface the failure reason (e.g. the branch-conflict guard's 409) instead of
  // silently swallowing it — hovering shows the full message.
  const title =
    state === 'error'
      ? (errorMessage ?? 'Draft failed')
      : !idea.id
        ? 'Idea needs an ID before an agent can run'
        : !hasAgent
          ? 'No agent CLI found — set up in Settings'
          : undefined;

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={state === 'loading' || !idea.id || !hasAgent}
        style={{ color: state === 'error' ? color.accentRoseDark : color.textSecondary }}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
