import { useAppStore } from '@/app/stores/app-store';
import type { NightReportGroup, NightSuggestionEntry } from '@/types/index';
import { useNavigate } from '@tanstack/react-router';

export function criticalNightFindings(groups: NightReportGroup[]): NightSuggestionEntry[] {
  return groups
    .flatMap((group) => group.findings)
    .filter((finding) => finding.severity === 'critical');
}

export function formatCriticalSummary(criticals: NightSuggestionEntry[]): string {
  if (criticals.length === 1) {
    const [finding] = criticals;
    return `${finding.file}${finding.line ? `:${finding.line}` : ''} — ${finding.message}`;
  }
  return `${criticals.length} critical findings: ${criticals.map((f) => f.file).join(', ')}`;
}

export const NightCriticalBanner = () => {
  const nightReport = useAppStore((s) => s.nightReport);
  const navigate = useNavigate();

  const criticals = criticalNightFindings(nightReport);
  if (criticals.length === 0) return null;

  return (
    <div
      role="alert"
      className="bg-watercolor-rose-dark text-desk-text py-2 px-4 text-2xs font-mono shrink-0"
    >
      {/* Raw <button>, not paper-ui's Button — this needs to read as an inline text link. */}
      <button
        type="button"
        onClick={() => navigate({ to: '/' })}
        className="bg-none bg-transparent border-none p-0 cursor-pointer text-inherit underline [font:inherit] text-left"
      >
        Critical from the night shift — {formatCriticalSummary(criticals)}
      </button>
    </div>
  );
};
