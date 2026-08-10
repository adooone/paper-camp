import { DOCTOR_RULES_BY_ID, type DoctorRuleId, type DoctorSeverity } from './rules';

export interface DoctorFinding {
  file: string;
  line: number;
  rule: DoctorRuleId;
  message: string;
}

export function findingSeverity(finding: DoctorFinding): DoctorSeverity {
  return DOCTOR_RULES_BY_ID[finding.rule].severity;
}

const SEVERITY_RANK: Record<DoctorSeverity, number> = { error: 0, warning: 1 };

export function sortFindings(findings: DoctorFinding[]): DoctorFinding[] {
  return [...findings].sort(
    (a, b) =>
      a.file.localeCompare(b.file) ||
      a.line - b.line ||
      SEVERITY_RANK[findingSeverity(a)] - SEVERITY_RANK[findingSeverity(b)] ||
      a.rule.localeCompare(b.rule),
  );
}

export interface DoctorFindingWithSeverity extends DoctorFinding {
  severity: DoctorSeverity;
}

export interface DoctorFindingSummary {
  findings: DoctorFindingWithSeverity[];
  errorCount: number;
  warningCount: number;
}

export function describeFindings(findings: DoctorFinding[]): DoctorFindingSummary {
  const withSeverity = sortFindings(findings).map((finding) => ({
    ...finding,
    severity: findingSeverity(finding),
  }));
  return {
    findings: withSeverity,
    errorCount: withSeverity.filter((f) => f.severity === 'error').length,
    warningCount: withSeverity.filter((f) => f.severity === 'warning').length,
  };
}

export interface DoctorReport {
  text: string;
  errorCount: number;
  warningCount: number;
}

export function reportFindings(findings: DoctorFinding[]): DoctorReport {
  const sorted = sortFindings(findings);
  let errorCount = 0;
  let warningCount = 0;

  const lines = sorted.map((finding) => {
    const severity = findingSeverity(finding);
    if (severity === 'error') errorCount++;
    else warningCount++;
    return `${finding.file}:${finding.line}  ${severity.padEnd(7)} ${finding.rule}  ${finding.message}`;
  });

  const summary =
    sorted.length === 0
      ? 'paper-camp doctor: no issues found.'
      : `paper-camp doctor: ${errorCount} error(s), ${warningCount} warning(s).`;

  return {
    text: [...lines, ...(lines.length > 0 ? [''] : []), summary].join('\n'),
    errorCount,
    warningCount,
  };
}
