import { selectAgentBusy, useAppStore } from '@/app/stores/app-store';
import { color } from '@/app/styles/tokens';
import { Button, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildSuggestIdeasPrompt } from '../prompts';

// Not scoped to any plan or idea, so — unlike ActualiseAllButton, which rewrites
// entity prose — this needs no branch-conflict guard.
export const SuggestIdeasButton = () => {
  const launchSuggestIdeas = useAppStore((s) => s.launchSuggestIdeas);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const suggestions = useAppStore((s) => s.suggestions);
  const agentBusy = useAppStore(selectAgentBusy);
  const { toast } = useToast();
  const [launching, setLaunching] = useState(false);

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
