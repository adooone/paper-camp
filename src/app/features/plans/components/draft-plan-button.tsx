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
  const { state, run } = useActionFeedback();

  const handleClick = () => {
    const id = idea.id;
    if (!id) return;
    run(async () => {
      await launchPlanDraft(id, buildPlanDraftPrompt(idea, otherPlans));
    });
  };

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={agentBusy || state === 'loading' || !idea.id}
      title={idea.id ? undefined : 'Idea needs an ID before an agent can run'}
      style={{ color: color.textSecondary }}
    >
      {state === 'loading' ? 'Drafting…' : state === 'success' ? 'Draft sent!' : 'Draft plan'}
    </Button>
  );
};
