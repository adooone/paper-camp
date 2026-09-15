import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts';
import { entityRouteParam } from '@/app/hooks';
import { fetchNightFindingStaleness } from '@/app/services/content';
import { useAppStore } from '@/app/stores/app-store';
import { surface } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { logRowIdForTask } from '@/core/run-rows';
import type { AgentTaskState, NightSuggestionEntry, TaskLogEntry } from '@/types/index';
import { Button, Card, Stamp, type StampVariant, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useFindingFixTask } from '../hooks';
import { SEVERITY_STAMP_VARIANT } from './night-report-section';

interface FindingDetailProps {
  finding: NightSuggestionEntry;
}

interface Fact {
  label: string;
  value: string;
}

const FactsGrid = ({ facts }: { facts: Fact[] }) => (
  <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-x-4 gap-y-2">
    {facts.map((fact) => (
      <div key={fact.label} className="flex min-w-0 flex-col">
        <dt className="font-handwritten text-xs font-semibold opacity-[0.45] whitespace-nowrap">
          {fact.label}
        </dt>
        <dd className="m-0 font-handwritten text-base font-semibold whitespace-nowrap">
          {fact.value}
        </dd>
      </div>
    ))}
  </dl>
);

const FIX_OUTCOME_VARIANT: Record<string, StampVariant> = {
  done: 'success',
  error: 'error',
  superseded: 'neutral',
  interrupted: 'warning',
};

const FIX_OUTCOME_LABEL: Record<string, string> = {
  done: 'fixed',
  error: 'fix failed',
  superseded: 'superseded',
  interrupted: 'interrupted',
};

const FixTaskCard = ({
  activeTask,
  outcome,
}: {
  activeTask?: AgentTaskState;
  outcome?: TaskLogEntry;
}) => {
  const navigate = useNavigate();
  if (!activeTask && !outcome) return null;
  const entryId = activeTask ? logRowIdForTask(activeTask) : `task:${outcome?.id}`;
  const label = activeTask ? 'fixing…' : (FIX_OUTCOME_LABEL[outcome?.outcome ?? ''] ?? 'unknown');
  const variant: StampVariant = activeTask
    ? 'warning'
    : (FIX_OUTCOME_VARIANT[outcome?.outcome ?? ''] ?? 'neutral');
  return (
    <button
      type="button"
      onClick={() => navigate({ to: '/log/$entryId', params: { entryId } })}
      className="mb-4 block w-full cursor-pointer border-none bg-transparent p-0 text-left"
    >
      <Card size="small" texture={surface.card}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm opacity-70">Fix it here</span>
          <Stamp size="small" variant={variant}>
            {label}
          </Stamp>
        </div>
      </Card>
    </button>
  );
};

export const FindingDetail = ({ finding }: FindingDetailProps) => {
  const [stale, setStale] = useState<boolean | null>(null);
  const promoteNightFinding = useAppStore((s) => s.promoteNightFinding);
  const dismissNightFinding = useAppStore((s) => s.dismissNightFinding);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const [promoting, setPromoting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    activeTask: fixTask,
    outcome: fixOutcome,
    launching: fixing,
    launchFix,
  } = useFindingFixTask(finding);

  useEffect(() => {
    setStale(null);
    fetchNightFindingStaleness(finding)
      .then((result) => setStale(result.stale))
      .catch(() => setStale(null));
  }, [finding]);

  const handlePromote = async () => {
    setPromoting(true);
    setError(null);
    try {
      const id = await promoteNightFinding(finding);
      const idea = useAppStore.getState().ideaEntries.find((e) => e.id === id);
      if (idea) {
        try {
          await launchIdeaExtend(id, buildSuggestionPromotePrompt(idea));
        } catch (err) {
          toast({
            title: 'Idea created, but the refine agent failed to launch',
            description: oneLineErrorSummary((err as Error).message),
            variant: 'error',
          });
        }
      }
      navigate({
        to: '/ideas/$ideaId',
        params: { ideaId: entityRouteParam(id, idea?.title ?? '') },
      });
    } catch (err) {
      setError((err as Error).message);
      setPromoting(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await dismissNightFinding(finding);
      navigate({ to: '/' });
    } catch (err) {
      toast({
        title: 'Failed to dismiss finding',
        description: (err as Error).message,
        variant: 'error',
      });
      setDismissing(false);
    }
  };

  const handleFixItHere = async () => {
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

  const facts: Fact[] = [
    { label: 'Commit', value: finding.commit.slice(0, 7) },
    { label: 'Date', value: finding.date },
    {
      label: 'File changed since',
      value: stale === null ? 'checking…' : stale ? 'yes' : 'no',
    },
  ];

  return (
    <div>
      <Card size="small" texture={surface.card} className="mb-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Stamp size="small" variant="neutral">
              {finding.check}
            </Stamp>
            <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
              {finding.severity}
            </Stamp>
            <span className="text-sm opacity-60">{finding.chunk}</span>
            <span className="font-mono text-sm opacity-80">
              {finding.file}
              {finding.line ? `:${finding.line}` : ''}
            </span>
          </div>
          <p className="m-0 text-base leading-[1.7]">{finding.message}</p>
          <div className="border-t border-paper-950/[12%] pt-3">
            <FactsGrid facts={facts} />
          </div>
        </div>
      </Card>
      <FixTaskCard activeTask={fixTask} outcome={fixOutcome} />
      <div className="flex items-center justify-end gap-2 border-t border-paper-950/[12%] pt-4">
        {error && <p className="m-0 mr-auto text-watercolor-rose-dark text-sm">{error}</p>}
        <Button
          type="button"
          variant="ghost"
          onClick={handleDismiss}
          disabled={promoting || dismissing || fixing || Boolean(fixTask)}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleFixItHere}
          disabled={promoting || dismissing || fixing || Boolean(fixTask)}
        >
          {fixing || fixTask ? 'Fixing…' : 'Fix it here'}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handlePromote}
          disabled={promoting || dismissing || fixing || Boolean(fixTask)}
        >
          {promoting ? 'Promoting…' : 'Promote'}
        </Button>
      </div>
    </div>
  );
};
