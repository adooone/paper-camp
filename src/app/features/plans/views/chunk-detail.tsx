import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts';
import type { ActiveNightChunk } from '@/app/hooks';
import { entityRouteParam } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { nightFindingKey, sortedFindings } from '@/core/night-findings';
import type { NightSuggestionEntry } from '@/types/index';
import { Button, Card, Divider, FactsGrid, Stamp, useToast } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import { Fragment, useState } from 'react';
import { useFindingFixTask } from '../hooks';
import { SEVERITY_STAMP_VARIANT, severityCounts } from './night-report-section';

interface ChunkDetailProps {
  chunk: ActiveNightChunk;
}

interface Fact {
  label: string;
  value: string;
}

const FindingActions = ({ finding }: { finding: NightSuggestionEntry }) => {
  const promoteNightFinding = useAppStore((s) => s.promoteNightFinding);
  const dismissNightFinding = useAppStore((s) => s.dismissNightFinding);
  const launchIdeaExtend = useAppStore((s) => s.launchIdeaExtend);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTask, launching, launchFix } = useFindingFixTask([finding]);
  const fixing = launching || Boolean(activeTask);
  const [promoting, setPromoting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const disabled = fixing || promoting || dismissing;

  const handleFix = async () => {
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

  const handlePromote = async () => {
    setPromoting(true);
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
      toast({
        title: 'Failed to promote finding',
        description: (err as Error).message,
        variant: 'error',
      });
      setPromoting(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await dismissNightFinding(finding);
    } catch (err) {
      toast({
        title: 'Failed to dismiss finding',
        description: (err as Error).message,
        variant: 'error',
      });
      setDismissing(false);
    }
  };

  if (fixing) {
    return (
      <Stamp size="small" variant="warning">
        fixing…
      </Stamp>
    );
  }

  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <Button type="button" variant="ghost" size="small" onClick={handleFix} disabled={disabled}>
        Fix
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={handlePromote}
        disabled={disabled}
      >
        {promoting ? 'Promoting…' : 'Promote'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="small"
        onClick={handleDismiss}
        disabled={disabled}
      >
        {dismissing ? 'Dismissing…' : 'Dismiss'}
      </Button>
    </div>
  );
};

export const ChunkDetail = ({ chunk }: ChunkDetailProps) => {
  const { toast } = useToast();
  const { activeTask, launching, launchFix } = useFindingFixTask(chunk.findings);
  const fixing = launching || Boolean(activeTask);

  const facts: Fact[] = [
    { label: 'Date', value: chunk.date },
    { label: 'Passes', value: String(chunk.passCount) },
    { label: 'Cost', value: `$${chunk.costUsd.toFixed(2)}` },
  ];

  const handleFixAll = async () => {
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

  return (
    <div>
      <Card size="small" texture={surface.card} className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="font-mono text-base opacity-80">{chunk.chunk}</span>
            {severityCounts(chunk.findings).map(({ severity, count }) => (
              <Stamp key={severity} size="small" variant={SEVERITY_STAMP_VARIANT[severity]}>
                {count} {severity}
              </Stamp>
            ))}
            {fixing && (
              <Stamp size="small" variant="warning">
                fixing…
              </Stamp>
            )}
          </div>
          <FactsGrid items={facts} layout="inline" align="end" />
        </div>
      </Card>
      <Card size="small" texture={surface.card} className="mb-4">
        {sortedFindings(chunk.findings).map((finding, index) => (
          <Fragment key={nightFindingKey(finding)}>
            {index > 0 && <Divider sketch />}
            <article className="flex flex-col gap-1.5 py-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
                  {finding.severity}
                </Stamp>
                <Stamp size="small" variant="neutral">
                  {finding.check}
                </Stamp>
                <span
                  className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm opacity-80"
                  title={finding.file}
                >
                  {finding.file}
                  {finding.line ? `:${finding.line}` : ''}
                </span>
                <FindingActions finding={finding} />
              </div>
              <p className="m-0 text-sm leading-relaxed opacity-80">{finding.message}</p>
            </article>
          </Fragment>
        ))}
      </Card>
      <div className="flex items-center justify-end gap-2 border-t border-paper-950/[12%] pt-4">
        <Button type="button" variant="primary" onClick={handleFixAll} disabled={fixing}>
          {fixing ? 'Fixing…' : 'Fix all'}
        </Button>
      </div>
    </div>
  );
};
