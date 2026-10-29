import type { DoctorCheck } from '../doctor';

const checkTrackedOutsidePlan: DoctorCheck = ({ localStateDrift }) =>
  (localStateDrift?.trackedOutsidePlan ?? []).map((file) => ({
    file,
    line: 1,
    rule: 'local-state-tracked-outside-plan',
    message:
      'tracked in git but not part of the plan — run `paper-camp doctor --fix` to move it under papercamp/.local/ (or the account config dir) and untrack it.',
  }));

const checkMissingLocalGitignore: DoctorCheck = ({ localStateDrift }) =>
  localStateDrift && !localStateDrift.hasLocalGitignore
    ? [
        {
          file: 'papercamp/.local/.gitignore',
          line: 1,
          rule: 'local-state-missing-local-gitignore',
          message:
            'missing — nothing under papercamp/.local/ is protected from being committed; run `paper-camp doctor --fix` to create it.',
        },
      ]
    : [];

const checkMissingGitattributesBlock: DoctorCheck = ({ localStateDrift }) =>
  localStateDrift && !localStateDrift.hasGitattributesBlock
    ? [
        {
          file: '.gitattributes',
          line: 1,
          rule: 'local-state-missing-gitattributes-block',
          message:
            'missing the paper-camp managed block — two clones appending to papercamp/chat.md will conflict on pull; run `paper-camp doctor --fix` to add it.',
        },
      ]
    : [];

export const localStateChecks: DoctorCheck[] = [
  checkTrackedOutsidePlan,
  checkMissingLocalGitignore,
  checkMissingGitattributesBlock,
];
