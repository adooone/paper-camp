import type { DoctorContext, DoctorEntityFile } from './doctor';
import type { DoctorFinding } from './finding';
import type { DoctorRuleId } from './rules';

export type DoctorFixAction =
  | { kind: 'move'; from: string; to: string }
  | { kind: 'rewrite'; path: string; content: string };

export interface DoctorFixer {
  rule: DoctorRuleId;
  fix: (finding: DoctorFinding, file: DoctorEntityFile) => DoctorFixAction | null;
}

const archivePlacementFixer: DoctorFixer = {
  rule: 'archive-placement',
  fix: (_finding, file) => ({
    kind: 'move',
    from: file.path,
    to: file.archived
      ? file.path.replace('/archive/', '/')
      : file.path.replace(/\/(?=[^/]+$)/, '/archive/'),
  }),
};

export const DOCTOR_FIXERS: DoctorFixer[] = [archivePlacementFixer];

const FIXERS_BY_RULE = new Map<DoctorRuleId, DoctorFixer>(
  DOCTOR_FIXERS.map((fixer) => [fixer.rule, fixer]),
);

export interface DoctorFixPlan {
  actions: DoctorFixAction[];
  fixed: DoctorFinding[];
  unfixable: DoctorFinding[];
  rejected: DoctorFinding[];
}

export function planDoctorFixes(context: DoctorContext, findings: DoctorFinding[]): DoctorFixPlan {
  const fileByPath = new Map(context.files.map((file) => [file.path, file]));
  const actions: DoctorFixAction[] = [];
  const fixed: DoctorFinding[] = [];
  const unfixable: DoctorFinding[] = [];
  const rejected: DoctorFinding[] = [];

  for (const finding of findings) {
    const fixer = FIXERS_BY_RULE.get(finding.rule);
    const file = fileByPath.get(finding.file);
    const action = fixer && file ? fixer.fix(finding, file) : null;
    if (!action) {
      unfixable.push(finding);
      continue;
    }
    // A move onto an existing path would overwrite it (rename replaces the destination
    // on POSIX) and silently destroy the other entity — never auto-fix that.
    if (action.kind === 'move' && fileByPath.has(action.to)) {
      rejected.push(finding);
      continue;
    }
    actions.push(action);
    fixed.push(finding);
  }

  return { actions, fixed, unfixable, rejected };
}
