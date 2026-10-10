import { DRAFT_PR_TEMPLATE_VERSION, draftPrTemplateVersion } from '../../scaffold/templates';
import type { DoctorCheck } from '../doctor';
import type { DoctorFinding } from '../finding';

const CLAUDE_SETTINGS_PATH = '.claude/settings.json';
const DRAFT_PR_WORKFLOW_PATH = '.github/workflows/draft-pr.yml';
const PULL_REQUEST_TEMPLATE_PATH = '.github/pull_request_template.md';

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

function draftPrTemplateFinding(path: string, content: string | null | undefined): DoctorFinding[] {
  if (content === undefined) return [];
  if (content === null) {
    return [
      {
        file: path,
        line: 1,
        rule: 'draft-pr-template-outdated',
        message:
          'missing — run `paper-camp doctor --fix` to write it, or re-save the Draft PR setting.',
      },
    ];
  }
  const version = draftPrTemplateVersion(content);
  if (version === null) {
    return [
      {
        file: path,
        line: 1,
        rule: 'draft-pr-template-unmanaged',
        message:
          'exists without the paper-camp template header — this looks hand-written, so it will not be overwritten.',
      },
    ];
  }
  if (version < DRAFT_PR_TEMPLATE_VERSION) {
    return [
      {
        file: path,
        line: 1,
        rule: 'draft-pr-template-outdated',
        message: `carries template v${version}, older than the bundled v${DRAFT_PR_TEMPLATE_VERSION} — run \`paper-camp doctor --fix\` to update it.`,
      },
    ];
  }
  return [];
}

const checkDraftPrTemplatesStale: DoctorCheck = ({
  config,
  draftPrWorkflowContent,
  pullRequestTemplateContent,
}) =>
  config?.desk?.ci?.draftPr
    ? [
        ...draftPrTemplateFinding(DRAFT_PR_WORKFLOW_PATH, draftPrWorkflowContent),
        ...draftPrTemplateFinding(PULL_REQUEST_TEMPLATE_PATH, pullRequestTemplateContent),
      ]
    : [];

export const toolingChecks: DoctorCheck[] = [
  checkPermissionsAllowMissing,
  checkDefaultAgentsMissing,
  checkDraftPrTemplatesStale,
];
