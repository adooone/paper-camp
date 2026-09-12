import type { NightFindingSeverity, NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { Card, IconButton, Stamp, type StampVariant } from '@dendelion/paper-ui';

interface NightReportSectionProps {
  groups: NightReportGroup[];
  onOpen: (finding: NightSuggestionEntry) => void;
  onDismiss: (finding: NightSuggestionEntry) => void;
}

const SEVERITY_STAMP_VARIANT: Record<NightFindingSeverity, StampVariant> = {
  critical: 'error',
  high: 'warning',
  normal: 'info',
};

const SEVERITY_ORDER: NightFindingSeverity[] = ['critical', 'high', 'normal'];

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

export function nightFindingKey(finding: NightSuggestionEntry): string {
  return `${finding.date}-${finding.check}-${finding.file}-${finding.line ?? 'null'}`;
}

export const NightReportSection = ({ groups, onOpen, onDismiss }: NightReportSectionProps) => {
  if (groups.length === 0) return null;

  return (
    <div className="mb-5">
      {groups.map((group) => (
        <div key={group.date} className="mb-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h2 className="text-sm m-0 opacity-60">Night report — {group.date}</h2>
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
            <div className="flex flex-col gap-1">
              {sortedFindings(group.findings).map((finding) => (
                <div key={nightFindingKey(finding)} className="rounded-[10px]">
                  <Card
                    size="small"
                    texture="canvas"
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
                        <Stamp size="small" variant="neutral">
                          night
                        </Stamp>
                        <Stamp size="small" variant={SEVERITY_STAMP_VARIANT[finding.severity]}>
                          {finding.severity}
                        </Stamp>
                        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                          {finding.file}
                          {finding.line ? `:${finding.line}` : ''} — {finding.message}
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
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
