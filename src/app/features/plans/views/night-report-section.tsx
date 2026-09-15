import { surface } from '@/app/styles/tokens';
import { nightFindingKey } from '@/core/night-findings';
import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { Card, IconButton, Stamp, type StampVariant } from '@dendelion/paper-ui';

interface NightReportSectionProps {
  groups: NightReportGroup[];
  onOpen: (finding: NightSuggestionEntry) => void;
  onDismiss: (finding: NightSuggestionEntry) => void;
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

const SEVERITY_ORDER: NightFindingSeverity[] = ['critical', 'high', 'normal'];

// Past this many findings in a date, a flat list stops being readable — group by chunk instead.
const CHUNK_COLLAPSE_THRESHOLD = 10;

export function severityCounts(
  findings: NightSuggestionEntry[],
): { severity: NightFindingSeverity; count: number }[] {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((f) => f.severity === severity).length,
  })).filter(({ count }) => count > 0);
}

export function sortedFindings(findings: NightSuggestionEntry[]): NightSuggestionEntry[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
      a.file.localeCompare(b.file),
  );
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

// Plain render functions, not components: called inline so the returned JSX joins the
// caller's own tree directly, rather than nesting as an opaque child component.
function renderFindingRow(finding: NightSuggestionEntry, { onOpen, onDismiss }: FindingRowsProps) {
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

function renderChunkGroup(
  chunk: string,
  findings: NightSuggestionEntry[],
  rowProps: FindingRowsProps,
) {
  return (
    // Raw <details>/<summary> — paper-ui has no disclosure component, and this needs no
    // state beyond the browser's own open/closed toggle.
    <details key={chunk}>
      <summary className="flex w-full cursor-pointer list-none items-center gap-2 py-1 opacity-70 [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-xs">{chunk}</span>
        <span className="text-2xs opacity-60">
          {findings.length} {findings.length === 1 ? 'finding' : 'findings'}
        </span>
      </summary>
      <div className="flex flex-col gap-1 pl-5 pt-1">
        {findings.map((finding) => renderFindingRow(finding, rowProps))}
      </div>
    </details>
  );
}

function renderFindingsList(findings: NightSuggestionEntry[], rowProps: FindingRowsProps) {
  const sorted = sortedFindings(findings);
  if (sorted.length <= CHUNK_COLLAPSE_THRESHOLD) {
    return (
      <div className="flex flex-col gap-1">
        {sorted.map((finding) => renderFindingRow(finding, rowProps))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {groupByChunk(sorted).map(({ chunk, findings: chunkFindings }) =>
        renderChunkGroup(chunk, chunkFindings, rowProps),
      )}
    </div>
  );
}

export const NightReportSection = ({ groups, onOpen, onDismiss }: NightReportSectionProps) => {
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
            renderFindingsList(group.findings, { onOpen, onDismiss })
          )}
        </div>
      ))}
    </div>
  );
};
