import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { SEVERITY_ORDER, sortedFindings } from '@/core/night-findings';
import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { Button, Card, Stamp, type StampVariant, useToast } from '@dendelion/paper-ui';
import { useFindingFixTask } from '../hooks';

interface NightReportSectionProps {
  groups: NightReportGroup[];
}

export const SEVERITY_STAMP_VARIANT: Record<NightFindingSeverity, StampVariant> = {
  critical: 'error',
  high: 'warning',
  normal: 'info',
};

export { sortedFindings };

export function severityCounts(
  findings: NightSuggestionEntry[],
): { severity: NightFindingSeverity; count: number }[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((f) => f.severity === severity).length,
  })).filter(({ count }) => count > 0);
}

export function groupByChunk(
  findings: NightSuggestionEntry[],
): { chunk: string; findings: NightSuggestionEntry[] }[] {
  const order: string[] = [];
  const byChunk = new Map<string, NightSuggestionEntry[]>();
  for (const finding of findings) {
    if (!byChunk.has(finding.chunk)) {
      order.push(finding.chunk);
      byChunk.set(finding.chunk, []);
    }
    byChunk.get(finding.chunk)?.push(finding);
  }
  return order.map((chunk) => ({ chunk, findings: byChunk.get(chunk) ?? [] }));
}

function checksLine(findings: NightSuggestionEntry[]): string {
  return Array.from(new Set(findings.map((f) => f.check))).join(', ');
}

function ChunkCard({ chunk, findings }: { chunk: string; findings: NightSuggestionEntry[] }) {
  const { activeTask, launching, launchFix } = useFindingFixTask(findings);
  const { toast } = useToast();
  const fixing = launching || Boolean(activeTask);

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
    <Card size="small" texture="kraft">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm">
            {chunk}
          </span>
          {fixing && (
            <Stamp size="small" variant="warning">
              fixing…
            </Stamp>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {severityCounts(findings).map(({ severity, count }) => (
            <Stamp key={severity} size="small" variant={SEVERITY_STAMP_VARIANT[severity]}>
              {count} {severity}
            </Stamp>
          ))}
        </div>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-2xs opacity-60">
          {checksLine(findings)}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={handleFixAll}
          disabled={fixing}
        >
          {fixing ? 'Fixing…' : 'Fix all'}
        </Button>
      </div>
    </Card>
  );
}

function renderChunkCards(findings: NightSuggestionEntry[]) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {groupByChunk(sortedFindings(findings)).map(({ chunk, findings: chunkFindings }) => (
        <ChunkCard key={chunk} chunk={chunk} findings={chunkFindings} />
      ))}
    </div>
  );
}

export const NightReportSection = ({ groups }: NightReportSectionProps) => {
  if (groups.length === 0) return null;

  return (
    <div className="mb-5">
      {groups.map((group) => (
        <div key={group.date} className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h2 className="text-sm m-0 opacity-60">Review findings — {group.date}</h2>
            <Stamp size="small" variant="neutral">
              {group.passCount} {group.passCount === 1 ? 'pass' : 'passes'} · $
              {group.costUsd.toFixed(2)}
            </Stamp>
            {severityCounts(group.findings).map(({ severity, count }) => (
              <Stamp key={severity} size="small" variant={SEVERITY_STAMP_VARIANT[severity]}>
                {count} {severity}
              </Stamp>
            ))}
          </div>
          {group.findings.length === 0 ? (
            <p className="m-0 opacity-50 text-2xs">Ran clean — no findings.</p>
          ) : (
            renderChunkCards(group.findings)
          )}
        </div>
      ))}
    </div>
  );
};
