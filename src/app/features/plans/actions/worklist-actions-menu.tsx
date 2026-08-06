import { MoreIcon, ShuffleIcon, WandIcon } from '@/app/components/icons';
import { selectAgentBusy, selectHasAnyAgent, useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { CheckIcon, IconButton, Menu, type MenuEntry, useToast } from '@dendelion/paper-ui';
import { useState } from 'react';
import { buildSuggestIdeasPrompt } from '../prompts';

type RunningAction = 'suggest' | 'reconcile' | 'prioritise' | null;

export const WorklistActionsMenu = () => {
  const launchSuggestIdeas = useAppStore((s) => s.launchSuggestIdeas);
  const launchBatchReconcile = useAppStore((s) => s.launchBatchReconcile);
  const launchPrioritise = useAppStore((s) => s.launchPrioritise);
  const ideaEntries = useAppStore((s) => s.ideaEntries);
  const suggestions = useAppStore((s) => s.suggestions);
  const agentBusy = useAppStore(selectAgentBusy);
  const hasAgent = useAppStore(selectHasAnyAgent);
  const { toast } = useToast();
  const [running, setRunning] = useState<RunningAction>(null);

  const handleSuggestIdeas = async () => {
    setRunning('suggest');
    try {
      await launchSuggestIdeas(buildSuggestIdeasPrompt(ideaEntries, suggestions));
    } catch (err) {
      toast({
        title: 'Failed to launch',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setRunning(null);
    }
  };

  const handleReconcileAll = async () => {
    setRunning('reconcile');
    try {
      await launchBatchReconcile();
    } catch (err) {
      toast({
        title: 'Failed to launch',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setRunning(null);
    }
  };

  const handlePrioritise = async () => {
    setRunning('prioritise');
    try {
      const result = await launchPrioritise();
      toast({
        title: result.moved.length > 0 ? 'Queue reordered' : 'Already in order',
        description: result.why || undefined,
        variant: 'success',
      });
    } catch (err) {
      toast({
        title: 'Failed to prioritise',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    } finally {
      setRunning(null);
    }
  };

  const busy = running !== null || agentBusy;

  const items: MenuEntry[] = [
    {
      id: 'suggest-ideas',
      label: running === 'suggest' ? 'Starting…' : 'Suggest ideas',
      icon: <WandIcon size={16} />,
      disabled: busy || !hasAgent,
      onSelect: handleSuggestIdeas,
    },
    {
      id: 'reconcile-all',
      label: running === 'reconcile' ? 'Starting…' : 'Reconcile all',
      icon: <CheckIcon size={16} />,
      disabled: busy || !hasAgent,
      onSelect: handleReconcileAll,
    },
    {
      id: 'prioritise',
      label: running === 'prioritise' ? 'Prioritising…' : 'Prioritise queue',
      icon: <ShuffleIcon size={16} />,
      disabled: busy || !hasAgent,
      onSelect: handlePrioritise,
    },
  ];

  return (
    <Menu
      align="end"
      trigger={
        <IconButton
          icon={<MoreIcon size={16} />}
          label="More actions"
          size="small"
          variant="ghost"
        />
      }
      items={items}
    />
  );
};
