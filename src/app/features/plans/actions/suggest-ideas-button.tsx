import { useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildSuggestIdeasPrompt } from '../prompts';

/**
 * Manual trigger for IDEA-62 phase 4: launches an agent that scans the repo and
 * existing corpus and appends new lines to papercamp/suggestions.md via the dated
 * grammar. Not scoped to any plan or idea, so — unlike ActualiseAllButton, which
 * still needs the branch-conflict guard because it rewrites entity prose — this
 * needs no id and no guard (see launch-suggest's route comment).
 */
export const SuggestIdeasButton = () => {
  const launchSuggestIdeas = useAppStore((s) => s.launchSuggestIdeas);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const suggestions = useAppStore((s) => s.suggestions);
  const agentStatus = useAppStore((s) => s.agentStatus);
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

  const agentBusy = agentStatus.some((t) => t.status !== 'done' && t.status !== 'error');

  const handleClick = async () => {
    setLaunching(true);
    try {
      await launchSuggestIdeas(buildSuggestIdeasPrompt(ideaEntries, suggestions));
    } catch (err) {
      toast({
        title: 'Failed to launch',
        description: (err as Error).message,
        variant: 'error',
      });
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="small"
      onClick={handleClick}
      disabled={agentBusy || launching}
      style={{ color: color.textSecondary }}
    >
      Suggest ideas
    </Button>
  );
};
