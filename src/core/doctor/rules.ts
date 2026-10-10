export type DoctorSeverity = 'error' | 'warning';

export type DoctorCategory = 'metadata' | 'structural' | 'tooling';

export interface DoctorRule {
  id: string;
  category: DoctorCategory;
  severity: DoctorSeverity;
  summary: string;
}

export const DOCTOR_RULES = [
  {
    id: 'frontmatter-schema',
    category: 'metadata',
    severity: 'error',
    summary:
      'Frontmatter fails entityFrontmatterSchema — missing required field, bad enum, malformed date, or a violated note/status refinement.',
  },
  {
    id: 'filename-id-mismatch',
    category: 'metadata',
    severity: 'error',
    summary: 'Frontmatter id does not match the file name (IDEA-N.md); references break silently.',
  },
  {
    id: 'duplicate-id',
    category: 'metadata',
    severity: 'error',
    summary: 'Two entity files share one id; whichever loads last wins and the other disappears.',
  },
  {
    id: 'id-counter-stale',
    category: 'metadata',
    severity: 'error',
    summary:
      'An entity id is greater than or equal to config.nextId.idea, so the next mint collides with an existing file.',
  },
  {
    id: 'corpus-format-too-new',
    category: 'metadata',
    severity: 'error',
    summary:
      'config.version is newer than the format this paper-camp understands; reads stay tolerant but writes are refused until it upgrades.',
  },
  {
    id: 'phases-list-split',
    category: 'structural',
    severity: 'error',
    summary:
      'A checkbox line lives outside the Phases section — a mid-file heading split the list and orphaned phases, so the entity parses as fewer phases than it has.',
  },
  {
    id: 'note-has-phases',
    category: 'structural',
    severity: 'error',
    summary: 'A kind: note entity carries a Phases section; notes never grow phases.',
  },
  {
    id: 'duplicate-phases-section',
    category: 'structural',
    severity: 'error',
    summary:
      'A file carries more than one Phases heading — a redraft appended instead of replacing the existing list in place.',
  },
  {
    id: 'no-agent-phase',
    category: 'structural',
    severity: 'warning',
    summary:
      'A planned/in-progress/review entity has no phase an agent can run — every phase is `[manual]` or the Phases section is empty, so the idea can never move on its own.',
  },
  {
    id: 'archive-placement',
    category: 'structural',
    severity: 'warning',
    summary:
      'File location contradicts status — a done/dropped entity still under ideas/, or an active entity already under ideas/archive/.',
  },
  {
    id: 'dangling-link',
    category: 'structural',
    severity: 'warning',
    summary: 'A [[IDEA-N]] wikilink targets an id that no entity in the corpus defines.',
  },
  {
    id: 'missing-permissions-allow',
    category: 'tooling',
    severity: 'warning',
    summary:
      '.claude/settings.json has no permissions.allow list, so a headless run denies every edit and shell command outside the defaults — run `paper-camp init --settings` to add it.',
  },
  {
    id: 'no-default-agents',
    category: 'tooling',
    severity: 'warning',
    summary:
      'config.json has no defaultAgents, so every run uses the built-in agent and model — choose them in Settings → General so a project never runs on a fallback it did not pick.',
  },
  {
    id: 'draft-pr-template-outdated',
    category: 'tooling',
    severity: 'warning',
    summary:
      'desk.ci.draftPr is on but .github/workflows/draft-pr.yml or .github/pull_request_template.md is missing or carries an older paper-camp template version — run `paper-camp doctor --fix` to rewrite it.',
  },
  {
    id: 'draft-pr-template-unmanaged',
    category: 'tooling',
    severity: 'warning',
    summary:
      'desk.ci.draftPr is on but the workflow or PR template file has no paper-camp template header, so it looks hand-written — paper-camp will not overwrite it.',
  },
] as const satisfies readonly DoctorRule[];

export type DoctorRuleId = (typeof DOCTOR_RULES)[number]['id'];

export const DOCTOR_RULES_BY_ID: Record<DoctorRuleId, DoctorRule> = Object.fromEntries(
  DOCTOR_RULES.map((rule) => [rule.id, rule]),
) as Record<DoctorRuleId, DoctorRule>;
