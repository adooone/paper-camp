export type DoctorSeverity = 'error' | 'warning';

export type DoctorCategory = 'metadata' | 'structural';

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
] as const satisfies readonly DoctorRule[];

export type DoctorRuleId = (typeof DOCTOR_RULES)[number]['id'];

export const DOCTOR_RULES_BY_ID: Record<DoctorRuleId, DoctorRule> = Object.fromEntries(
  DOCTOR_RULES.map((rule) => [rule.id, rule]),
) as Record<DoctorRuleId, DoctorRule>;
