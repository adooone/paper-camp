import type { PhaseItem } from '@/types/index';

/** Loose shape: field names vary across /code-review's JSON output and similar tools. */
interface ReviewFinding {
  description?: string;
  title?: string;
  summary?: string;
  file?: string;
  line?: number;
  line_start?: number;
  line_end?: number;
  failure_scenario?: string;
  reasoning?: string;
}

const formatLocation = (finding: ReviewFinding): string | undefined => {
  if (!finding.file) return undefined;
  const start = finding.line_start ?? finding.line;
  if (!start) return finding.file;
  const end = finding.line_end && finding.line_end !== start ? `-${finding.line_end}` : '';
  return `${finding.file}:${start}${end}`;
};

const findingToPhase = (finding: ReviewFinding, index: number): PhaseItem => {
  const text = finding.description ?? finding.title ?? finding.summary;
  if (!text?.trim()) {
    throw new Error(`Finding ${index + 1} has no description/title/summary`);
  }
  const description = [formatLocation(finding), finding.failure_scenario ?? finding.reasoning]
    .filter(Boolean)
    .join(' — ');
  return {
    done: false,
    text: text.trim(),
    description: description || undefined,
    source: 'review',
  };
};

/** Parses pasted /code-review JSON output (an array of findings, or `{ findings: [...] }`) into new phases. */
export const parseReviewFindings = (raw: string): PhaseItem[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Not valid JSON');
  }
  const findings = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { findings?: unknown })?.findings)
      ? (parsed as { findings: unknown[] }).findings
      : null;
  if (!findings) {
    throw new Error('Expected a JSON array of findings, or an object with a "findings" array');
  }
  if (findings.length === 0) {
    throw new Error('No findings to add');
  }
  return findings.map((finding, index) => findingToPhase(finding as ReviewFinding, index));
};
