import type { NightFindingSeverity, NightRawFinding } from '../types/index';

const SEVERITIES: NightFindingSeverity[] = ['critical', 'high', 'normal'];

export function parseNightCheckFindings(resultText: string): NightRawFinding[] | undefined {
  const match = resultText.match(/\[[\s\S]*\]/);
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;

  const findings: NightRawFinding[] = [];
  for (const entry of parsed as Record<string, unknown>[]) {
    if (typeof entry.file !== 'string' || !entry.file) return undefined;
    if (typeof entry.message !== 'string' || !entry.message) return undefined;
    const line = typeof entry.line === 'number' && Number.isInteger(entry.line) ? entry.line : null;
    findings.push({ file: entry.file, line, message: entry.message });
  }
  return findings;
}

export interface NightConfirmVerdict {
  confirmed: boolean;
  severity: NightFindingSeverity | null;
  reasoning: string;
}

export function parseNightConfirmVerdict(resultText: string): NightConfirmVerdict | undefined {
  const match = resultText.match(/\{[\s\S]*\}/);
  if (!match) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return undefined;
  }
  const data = parsed as Record<string, unknown>;
  if (typeof data.confirmed !== 'boolean') return undefined;
  if (!data.confirmed) {
    return { confirmed: false, severity: null, reasoning: readReasoning(data) };
  }
  if (
    typeof data.severity !== 'string' ||
    !SEVERITIES.includes(data.severity as NightFindingSeverity)
  ) {
    return undefined;
  }
  return {
    confirmed: true,
    severity: data.severity as NightFindingSeverity,
    reasoning: readReasoning(data),
  };
}

function readReasoning(data: Record<string, unknown>): string {
  return typeof data.reasoning === 'string' ? data.reasoning : '';
}
