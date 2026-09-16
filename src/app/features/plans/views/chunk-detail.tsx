import type { ActiveNightChunk } from '@/app/hooks';
import { useAppStore } from '@/app/stores/app-store';
import { surface } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { nightFindingKey, sortedFindings } from '@/core/night-findings';
import type { NightSuggestionEntry } from '@/types/index';
import { Button, Card, Stamp, useToast } from '@dendelion/paper-ui';
import { useNavigate } from '@tanstack/react-router';
import { useFindingFixTask } from '../hooks';
import { SEVERITY_STAMP_VARIANT, renderFindingRow, severityCounts } from './night-report-section';

interface ChunkDetailProps {
  chunk: ActiveNightChunk;
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

export const ChunkDetail = ({ chunk }: ChunkDetailProps) => {
  const dismissNightFinding = useAppStore((s) => s.dismissNightFinding);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeTask, launching, launchFix } = useFindingFixTask(chunk.findings);
  const fixing = launching || Boolean(activeTask);

  const facts: Fact[] = [
    { label: 'Date', value: chunk.date },
    { label: 'Passes', value: String(chunk.passCount) },
    { label: 'Cost', value: `$${chunk.costUsd.toFixed(2)}` },
  ];

  const handleOpenFinding = (finding: NightSuggestionEntry) => {
    navigate({
      to: '/findings/$findingId',
      params: { findingId: encodeURIComponent(nightFindingKey(finding)) },
    });
  };

  const handleDismissFinding = async (finding: NightSuggestionEntry) => {
    try {
      await dismissNightFinding(finding);
    } catch (err) {
      toast({
        title: 'Failed to dismiss finding',
        description: (err as Error).message,
        variant: 'error',
      });
    }
  };

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
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-base opacity-80">{chunk.chunk}</span>
            {fixing && (
              <Stamp size="small" variant="warning">
                fixing…
              </Stamp>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {severityCounts(chunk.findings).map(({ severity, count }) => (
              <Stamp key={severity} size="small" variant={SEVERITY_STAMP_VARIANT[severity]}>
                {count} {severity}
              </Stamp>
            ))}
          </div>
          <div className="border-t border-paper-950/[12%] pt-3">
            <FactsGrid facts={facts} />
          </div>
        </div>
      </Card>
      <div className="flex flex-col gap-1 mb-4">
        {sortedFindings(chunk.findings).map((finding) =>
          renderFindingRow(finding, { onOpen: handleOpenFinding, onDismiss: handleDismissFinding }),
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-paper-950/[12%] pt-4">
        <Button type="button" variant="primary" onClick={handleFixAll} disabled={fixing}>
          {fixing ? 'Fixing…' : 'Fix all'}
        </Button>
      </div>
    </div>
  );
};
