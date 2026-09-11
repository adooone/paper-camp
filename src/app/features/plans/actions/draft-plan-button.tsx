import { WandIcon } from '@/app/components/icons';
import { SidebarCommand } from '@/app/components/sidebar';
import { useActionFeedback } from '@/app/hooks/use-action-feedback';
import { selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { IdeaEntry, PlanEntry } from '@/types/index';
import { Button, Tooltip, useToast } from '@dendelion/paper-ui';
import { buildPlanDraftPrompt } from '../prompts';

interface DraftPlanButtonProps {
  idea: IdeaEntry;
  otherPlans: PlanEntry[];
  /** Extra classes for call sites that need it as a link rather than a button. */
  className?: string;
  /** Replaces the existing `### Phases` list in place instead of drafting a fresh one. */
  redraft?: boolean;
  /** Renders as a SidebarCommand row (the idea sidebar's Redraft slot) instead of a Button. */
  sidebar?: boolean;
}

export const DraftPlanButton = ({
  idea,
  otherPlans,
  className = '',
  redraft = false,
  sidebar = false,
}: DraftPlanButtonProps) => {
  const launchPlanDraft = useAppStore((s) => s.launchPlanDraft);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { state, errorMessage, run } = useActionFeedback();
  const { toast } = useToast();

  const handleClick = () => {
    const id = idea.id;
    if (!id) return;
    run(async () => {
      try {
        await launchPlanDraft(id, buildPlanDraftPrompt(idea, otherPlans, redraft));
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
      ? redraft
        ? 'Redrafting…'
        : 'Drafting…'
      : state === 'success'
        ? 'Draft sent!'
        : state === 'error'
          ? 'Draft failed'
          : redraft
            ? 'Redraft'
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

  if (sidebar) {
    return (
      <Tooltip content={title}>
        <SidebarCommand
          icon={<WandIcon size={16} />}
          onClick={handleClick}
          disabled={!idea.id || !hasAgent}
          busy={state === 'loading' ? label : undefined}
          tone={state === 'error' ? 'danger' : undefined}
        >
          {label}
        </SidebarCommand>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={title}>
      <Button
        variant="ghost"
        size="small"
        onClick={handleClick}
        disabled={state === 'loading' || !idea.id || !hasAgent}
        className={`${state === 'error' ? 'text-watercolor-rose-dark' : 'text-ink-500'} ${className}`}
      >
        {label}
      </Button>
    </Tooltip>
  );
};
