import { z } from 'zod';
import { AGENT_IDS } from '../../types/index';

export const agentConfigSchema = z.preprocess(
  (v) => (typeof v === 'string' ? { agent: v } : v),
  z.object({
    agent: z.enum(AGENT_IDS),
    model: z.string().optional(),
    effort: z.string().optional(),
  }),
);

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

// Field-based schemas: the monolithic `plans.md`/`decisions.md`/`open-questions.md`
// format, `## Heading` entries with `**Field:** value` lines below each heading.
export const planFieldsSchema = z.object({
  status: z.enum(['idea', 'planned', 'in-progress', 'review', 'done', 'dropped']),
  kind: z.enum(['feat', 'fix', 'chore', 'docs', 'refactor']).optional(),
  id: z.string().optional(),
  idea: z.string().optional(),
  agent: z.enum(AGENT_IDS).optional(),
  created: dateString,
  updated: dateString.optional(),
  tags: z.string().optional(),
});

export const decisionFieldsSchema = z.object({
  date: dateString,
  status: z.enum(['decided', 'superseded']),
  'superseded-by': z.string().optional(),
});

export const openQuestionFieldsSchema = z.object({
  status: z.enum(['open', 'resolved']),
  raised: dateString,
  'resolved-by': z.string().optional(),
  blocks: z.string().optional(),
});

// YAML frontmatter schemas: the per-file plan/idea format, `---`-delimited YAML
// metadata plus a markdown body. Field-based schemas above exist only until the
// monolithic-file format is fully migrated away.
export const planFrontmatterSchema = z.object({
  id: z.string().describe('Permanent plan ID, e.g. FEAT-24'),
  title: z.string().describe('Human-readable plan name, e.g. "Plan storage architecture"'),
  kind: z
    .enum(['feat', 'fix', 'chore', 'docs', 'refactor'])
    .describe('Plan kind matching Conventional Commits types'),
  status: z
    .enum(['idea', 'planned', 'in-progress', 'review', 'done', 'dropped'])
    .describe('Current lifecycle status'),
  idea: z.string().optional().describe('IDEA-N backlink if this plan grew out of an idea'),
  agent: z.enum(AGENT_IDS).optional().describe('Per-plan agent override'),
  created: dateString.describe('Creation date (YYYY-MM-DD)'),
  updated: dateString.optional().describe('Last significant update date (YYYY-MM-DD)'),
  audited: dateString.optional().describe('Date of last successful convergence audit (YYYY-MM-DD)'),
  'audited-hash': z
    .string()
    .optional()
    .describe('Content hash of the plan at last audit, used to detect edits regardless of mtime'),
  tags: z.array(z.string()).optional().describe('Tagging categories'),
});

export const ideaFrontmatterSchema = z
  .object({
    id: z.string().describe('Permanent idea ID, e.g. IDEA-20'),
    title: z.string().describe('Short idea headline (3-6 words)'),
    kind: z
      .enum(['idea', 'note'])
      .optional()
      .describe('"note" for ideas that never need a plan; omitted means a plan-bearing idea'),
    status: z
      .enum(['open', 'done', 'dropped'])
      .optional()
      .describe('Manual lifecycle, valid only on notes — plan-bearing ideas carry no status'),
  })
  .refine((data) => data.status === undefined || data.kind === 'note', {
    message: 'status is only valid on ideas with kind: note',
    path: ['status'],
  });

// Unified entity schema: one file per entity, with the plan as an optional
// `### Phases` body section. Replaces the legacy pair above once migration lands.
export const entityFrontmatterSchema = z
  .object({
    id: z.string().describe('Permanent lifetime entity ID, e.g. IDEA-45 — never changes'),
    title: z.string().describe('Human-readable entity name'),
    type: z
      .enum(['feat', 'fix', 'chore', 'docs', 'refactor'])
      .optional()
      .describe(
        'Work classification (Conventional Commits values) driving commit types and branch prefixes; usually set once a plan is drafted',
      ),
    kind: z
      .enum(['note'])
      .optional()
      .describe('"note" marks an entity that never grows phases; omitted for normal ideas'),
    status: z
      .enum(['idea', 'planned', 'in-progress', 'review', 'done', 'dropped', 'open'])
      .optional()
      .describe(
        'Stored override, no longer the source of truth: most lifecycle states derive from phases/branch/PR. Only dropped, a planless idea/note being closed, or the offline fallback need this set.',
      ),
    agent: z.enum(AGENT_IDS).optional().describe('Per-entity agent override'),
    created: dateString.describe('Creation date (YYYY-MM-DD)'),
    updated: dateString.optional().describe('Last significant update date (YYYY-MM-DD)'),
    audited: dateString
      .optional()
      .describe('Date of last successful convergence audit (YYYY-MM-DD)'),
    'audited-hash': z
      .string()
      .optional()
      .describe(
        'Content hash of the entity at last audit, used to detect edits regardless of mtime',
      ),
    tags: z.array(z.string()).optional().describe('Tagging categories'),
    subject: z
      .string()
      .optional()
      .describe('Subject group name; absent renders as the virtual "No subject" group'),
  })
  .refine(
    (data) =>
      data.kind !== 'note' ||
      data.status === undefined ||
      ['open', 'done', 'dropped'].includes(data.status),
    {
      message: 'a note entity must use status open, done, or dropped',
      path: ['status'],
    },
  )
  .refine((data) => data.kind === 'note' || data.status !== 'open', {
    message: 'status open is only valid on entities with kind: note',
    path: ['status'],
  });

export const paperCampConfigSchema = z.object({
  version: z.string(),
  projectName: z.string(),
  initializedAt: z.string(),
  nextId: z
    .object({
      // idea: unified-entity counter, all new entities mint lifetime IDEA-N ids from
      // here. The rest are legacy per-kind counters, still present in old configs.
      idea: z.number().optional(),
      feat: z.number().optional(),
      fix: z.number().optional(),
      chore: z.number().optional(),
      docs: z.number().optional(),
      refactor: z.number().optional(),
    })
    .optional(),
  defaultAgent: z.enum(AGENT_IDS).optional(),
  defaultAgents: z
    .object({
      phase: agentConfigSchema,
      planDraft: agentConfigSchema,
      ideaExtend: agentConfigSchema,
      commitSuggest: agentConfigSchema,
    })
    .optional(),
});

export type PlanFields = z.infer<typeof planFieldsSchema>;
export type DecisionFields = z.infer<typeof decisionFieldsSchema>;
export type OpenQuestionFields = z.infer<typeof openQuestionFieldsSchema>;
export type PlanFrontmatter = z.infer<typeof planFrontmatterSchema>;
export type IdeaFrontmatter = z.infer<typeof ideaFrontmatterSchema>;
export type EntityFrontmatter = z.infer<typeof entityFrontmatterSchema>;
