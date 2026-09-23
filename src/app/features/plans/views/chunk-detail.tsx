import { buildSuggestionPromotePrompt } from '@/app/features/plans/prompts';
import type { ActiveNightChunk } from '@/app/hooks';
import { entityRouteParam } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { nightFindingKey, sortedFindings } from '@/core/night-findings';
import type { NightSuggestionEntry } from '@/types/index';
import { Button, Card, FactsGrid, Stamp, Table, useToast } from '@dendelion/paper-ui';
import { surface } from '@dendelion/paper-ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useFindingFixTask } from '../hooks';
import { SEVERITY_STAMP_VARIANT, severityCounts } from './night-report-section';

interface ChunkDetailProps {
  chunk: ActiveNightChunk;
}

interface Fact {
  label: string;
  value: string;
}

const FindingActionsCell = ({ finding }: { finding: NightSuggestionEntry }) => {
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

  return (
    <div className="flex items-center justify-end gap-1">
      <Button type="button" variant="ghost" size="small" onClick={handleFix} disabled={disabled}>
        {fixing ? 'fixing…' : 'Fix'}
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
          <FactsGrid items={facts} />
        </div>
      </Card>
      <Table
        data={sortedFindings(chunk.findings)}
        rowKey={(finding) => nightFindingKey(finding)}
        hideHeader
        className="mb-4"
        columns={[
          {
            key: 'finding',
            header: '',
            cell: (finding: NightSuggestionEntry) => (
              <div className="flex flex-col gap-1.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
                    {finding.severity}
                  </Stamp>
                  <Stamp size="small" variant="neutral">
                    {finding.check}
                  </Stamp>
                  <span className="font-mono text-sm opacity-80">
                    {finding.file}
                    {finding.line ? `:${finding.line}` : ''}
                  </span>
                </div>
                <p className="m-0 text-sm opacity-80">{finding.message}</p>
              </div>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'end',
            width: 10,
            cell: (finding: NightSuggestionEntry) => <FindingActionsCell finding={finding} />,
          },
        ]}
      />
      <div className="flex items-center justify-end gap-2 border-t border-paper-950/[12%] pt-4">
        <Button type="button" variant="primary" onClick={handleFixAll} disabled={fixing}>
          {fixing ? 'Fixing…' : 'Fix all'}
        </Button>
      </div>
    </div>
  );
};
