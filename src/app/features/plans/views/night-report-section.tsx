import { surface } from '@/app/styles/tokens';
import { oneLineErrorSummary } from '@/app/utils/error-summary';
import { SEVERITY_ORDER, nightFindingKey, sortedFindings } from '@/core/night-findings';
import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { Button, Card, IconButton, Stamp, type StampVariant, useToast } from '@dendelion/paper-ui';
import { useFindingFixTask } from '../hooks';

interface NightReportSectionProps {
  groups: NightReportGroup[];
  onOpenChunk: (date: string, chunk: string) => void;
}

interface FindingRowsProps {
  onOpen: (finding: NightSuggestionEntry) => void;
  onDismiss: (finding: NightSuggestionEntry) => void;
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

// Plain render functions, not components: called inline so the returned JSX joins the
// caller's own tree directly, rather than nesting as an opaque child component.
export function renderFindingRow(
  finding: NightSuggestionEntry,
  { onOpen, onDismiss }: FindingRowsProps,
) {
  return (
    <div key={nightFindingKey(finding)} className="rounded-[10px]">
      <Card
        size="small"
        texture={surface.card}
        accent
        accentColor="slate"
        className="plan-row-card"
      >
        <div className="flex items-center gap-2">
          {/* Raw <button>, not paper-ui's Button — matches worklist-rows.tsx's titleButtonStyle. */}
          <button
            type="button"
            onClick={() => onOpen(finding)}
            className="flex-1 min-w-0 flex items-center gap-2 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit"
          >
            <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
              {finding.severity}
            </Stamp>
            <Stamp size="small" variant="neutral">
              {finding.check}
            </Stamp>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm opacity-80">
              {finding.file}
              {finding.line ? `:${finding.line}` : ''}
            </span>
          </button>
          <IconButton
            icon={<span>×</span>}
            variant="ghost"
            size="small"
            label="Dismiss"
            className="w-[28px] h-[28px]"
            onClick={() => onDismiss(finding)}
          />
        </div>
      </Card>
    </div>
  );
}

function ChunkCard({
  date,
  chunk,
  findings,
  onOpen,
}: {
  date: string;
  chunk: string;
  findings: NightSuggestionEntry[];
  onOpen: (date: string, chunk: string) => void;
}) {
  const { activeTask, launching } = useFindingFixTask(findings);
  const fixing = launching || Boolean(activeTask);

  return (
    <Card size="small" texture="kraft">
      {/* Raw <button>, not paper-ui's Button — this needs to read as the card's clickable body. */}
      <button
        type="button"
        onClick={() => onOpen(date, chunk)}
        className="flex w-full flex-col gap-1.5 bg-none bg-transparent border-none p-0 cursor-pointer text-left [font:inherit] text-inherit"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs font-semibold">
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
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs opacity-70">
          {checksLine(findings)}
        </span>
      </button>
    </Card>
  );
}

function renderChunkCards(
  date: string,
  findings: NightSuggestionEntry[],
  onOpenChunk: (date: string, chunk: string) => void,
) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {groupByChunk(sortedFindings(findings)).map(({ chunk, findings: chunkFindings }) => (
        <ChunkCard
          key={chunk}
          date={date}
          chunk={chunk}
          findings={chunkFindings}
          onOpen={onOpenChunk}
        />
      ))}
    </div>
  );
}

export const NightReportSection = ({ groups, onOpenChunk }: NightReportSectionProps) => {
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
            renderChunkCards(group.date, group.findings, onOpenChunk)
          )}
        </div>
      ))}
    </div>
  );
};
