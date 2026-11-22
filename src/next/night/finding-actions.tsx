import { useToast } from '@dendelion/folk-ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useFindingFixTask } from '@/app/features/plans/hooks/use-finding-fix-task';
import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts/prompts';
import { getCachedIdeas } from '@/app/services/query-client';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import type { NightSuggestionEntry } from '@/types/index';
import { SCREEN_PATHS } from '../shell/screens';
import { Button } from '../ui/button';
import { Stamp } from '../ui/stamp';
import styles from './night.module.css';

export function FixAll({ findings }: { findings: NightSuggestionEntry[] }) {
  const { toast } = useToast();
  const { activeTask, launching, launchFix } = useFindingFixTask(findings);
  const fixing = launching || Boolean(activeTask);
  const fix = async () => {
    try {
      await launchFix();
    } catch (err) {
      toast({
        title: 'Failed to launch the fix agent',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };
  return fixing ? (
    <Stamp meaning="running">fixing…</Stamp>
  ) : (
    <Button label="Fix all" size="xs" accessibilityLabel="Fix every finding" onPress={fix} />
  );
}

export function FindingActions({ finding }: { finding: NightSuggestionEntry }) {
  const promoteNightFinding = useAppStore((state) => state.promoteNightFinding);
  const dismissNightFinding = useAppStore((state) => state.dismissNightFinding);
  const launchIdeaExtend = useAppStore((state) => state.launchIdeaExtend);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTask, launching, launchFix } = useFindingFixTask([finding]);
  const [pending, setPending] = useState<'promote' | 'dismiss' | null>(null);
  const fixing = launching || Boolean(activeTask);
  const disabled = fixing || pending !== null;

  const fix = async () => {
    try {
      await launchFix();
    } catch (err) {
      toast({
        title: 'Failed to launch the fix agent',
        description: oneLineErrorSummary((err as Error).message),
        variant: 'error',
      });
    }
  };

  const promote = async () => {
    setPending('promote');
    try {
      const id = await promoteNightFinding(finding);
      const idea = getCachedIdeas().find((entry) => entry.id === id);
      if (idea) {
        await launchIdeaExtend(id, buildSuggestionPromotePrompt(idea)).catch((err) =>
          toast({
            title: 'Idea created, but the refine agent failed to launch',
            description: oneLineErrorSummary((err as Error).message),
            variant: 'error',
          }),
        );
      }
      await navigate({ to: `${SCREEN_PATHS.ideas}/${encodeURIComponent(id)}` });
    } catch (err) {
      toast({
        title: 'Failed to promote finding',
        description: (err as Error).message,
        variant: 'error',
      });
      setPending(null);
    }
  };

  const dismiss = async () => {
    setPending('dismiss');
    try {
      await dismissNightFinding(finding);
    } catch (err) {
      toast({
        title: 'Failed to dismiss finding',
        description: (err as Error).message,
        variant: 'error',
      });
      setPending(null);
    }
  };

  if (fixing) return <Stamp meaning="running">fixing…</Stamp>;
  return (
    <span className={styles.actions}>
      <Button label="Fix" variant="secondary" size="xs" disabled={disabled} onPress={fix} />
      <Button
        label={pending === 'promote' ? 'Promoting…' : 'Promote'}
        variant="secondary"
        size="xs"
        disabled={disabled}
        onPress={promote}
      />
      <Button
        label={pending === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
        variant="ghost"
        size="xs"
        disabled={disabled}
        onPress={dismiss}
      />
    </span>
  );
}
