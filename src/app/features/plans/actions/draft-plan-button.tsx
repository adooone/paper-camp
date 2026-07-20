import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
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
      : idea.id
        ? undefined
        : 'Idea needs an ID before an agent can run';

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={state === 'loading' || !idea.id}
        style={{ color: state === 'error' ? color.accentRoseDark : color.textSecondary }}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
