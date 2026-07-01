import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { Button } from '@dendelion/paper-ui';
import { buildPlanDraftPrompt } from '../prompts';

interface DraftPlanButtonProps {
  idea: IdeaEntry;
  otherPlans: PlanEntry[];
}

export const DraftPlanButton = ({ idea, otherPlans }: DraftPlanButtonProps) => {
  const launchPlanDraft = useAppStore((s) => s.launchPlanDraft);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const agentBusy =
    agentStatus !== null && agentStatus.status !== 'done' && agentStatus.status !== 'error';
  const { state, errorMessage, run } = useActionFeedback();

  const handleClick = () => {
    const id = idea.id;
    if (!id) return;
    run(async () => {
      await launchPlanDraft(id, buildPlanDraftPrompt(idea, otherPlans));
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
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={agentBusy || state === 'loading' || !idea.id}
      title={title}
      style={{ color: state === 'error' ? color.accentRoseDark : color.textSecondary }}
    >
      {label}
    </Button>
  );
};
