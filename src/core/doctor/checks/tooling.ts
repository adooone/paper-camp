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

const checkDefaultAgentsMissing: DoctorCheck = ({ config }) =>
  config && !config.defaultAgents
    ? [
        {
          file: 'papercamp/config.json',
          line: 1,
          rule: 'no-default-agents',
          message:
            'no defaultAgents — every run uses the built-in agent and model; choose them in Settings → General.',
        },
      ]
    : [];

export const toolingChecks: DoctorCheck[] = [
  checkPermissionsAllowMissing,
  checkDefaultAgentsMissing,
];
