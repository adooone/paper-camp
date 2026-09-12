import type { DoctorCheck } from '../doctor';

const CLAUDE_SETTINGS_PATH = '.claude/settings.json';

const checkPermissionsAllowMissing: DoctorCheck = ({ hasPermissionsAllow }) =>
  hasPermissionsAllow === false
    ? [
        {
          file: CLAUDE_SETTINGS_PATH,
          line: 1,
          rule: 'missing-permissions-allow',
          message:
            'no permissions.allow list — headless runs deny every edit and shell command outside the defaults; run `paper-camp init --settings` to add it.',
        },
      ]
    : [];

export const toolingChecks: DoctorCheck[] = [checkPermissionsAllowMissing];
