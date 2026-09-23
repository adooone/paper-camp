import { SEVERITY_ORDER, sortedFindings } from '@/core/night-findings';
import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { Card, Divider, Row, Stamp, type StampVariant } from '@dendelion/paper-ui';
import { Fragment } from 'react';
import { useFindingFixTask } from '../hooks';

interface NightReportSectionProps {
  groups: NightReportGroup[];
  onOpenChunk: (chunk: string) => void;
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

function ChunkRow({
  chunk,
  findings,
  onOpen,
}: {
  chunk: string;
  findings: NightSuggestionEntry[];
  onOpen: (chunk: string) => void;
}) {
  const { activeTask, launching } = useFindingFixTask(findings);
  const fixing = launching || Boolean(activeTask);

  return (
    <Row
      surface="none"
      columns={{ id: '7rem', title: '10rem', meta: 'minmax(0,1fr)', trailing: '4.5rem' }}
      onClick={() => onOpen(chunk)}
      ariaLabel={chunk}
      id={<span className="font-mono text-xs font-semibold">{chunk}</span>}
      title={
        <span className="flex flex-wrap items-center gap-1">
          {severityCounts(findings).map(({ severity, count }) => (
            <Stamp key={severity} size="small" variant={SEVERITY_STAMP_VARIANT[severity]}>
              {count} {severity}
            </Stamp>
          ))}
        </span>
      }
      meta={<span className="font-handwritten text-sm opacity-70">{checksLine(findings)}</span>}
      trailing={
        fixing && (
          <Stamp size="small" variant="warning">
            fixing…
          </Stamp>
        )
      }
    />
  );
}

export const NightReportSection = ({ groups, onOpenChunk }: NightReportSectionProps) => {
  const group = groups[0];
  if (!group || group.findings.length === 0) return null;

  return (
    <Card size="small" texture="kraft" className="mb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 pb-1">
        <h2 className="m-0 font-handwritten text-base font-semibold">Review findings</h2>
        <span className="font-handwritten text-sm opacity-60">
          {group.date} · {group.passCount} {group.passCount === 1 ? 'pass' : 'passes'} · $
          {group.costUsd.toFixed(2)}
        </span>
      </div>
      {groupByChunk(sortedFindings(group.findings)).map(({ chunk, findings }) => (
        <Fragment key={chunk}>
          <Divider sketch />
          <ChunkRow chunk={chunk} findings={findings} onOpen={onOpenChunk} />
        </Fragment>
      ))}
    </Card>
  );
};
