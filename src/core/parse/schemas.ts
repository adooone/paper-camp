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

// Field-based schema: the monolithic `plans.md` format, `## Heading` entries
// with `**Field:** value` lines below each heading.
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

/**
 * YAML frontmatter schema for the per-file plan format (`---`-delimited YAML plus a
 * markdown body). Field-based schemas above exist only until that format fully migrates.
 */
export const planFrontmatterSchema = z
  .object({
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
    audited: dateString
      .optional()
      .describe('Date of last successful convergence audit (YYYY-MM-DD)'),
    'audited-hash': z
      .string()
      .optional()
      .describe('Content hash of the plan at last audit, used to detect edits regardless of mtime'),
    tags: z.array(z.string()).optional().describe('Tagging categories'),
  })
  .passthrough();

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
  .passthrough()
  .refine((data) => data.status === undefined || data.kind === 'note', {
    message: 'status is only valid on ideas with kind: note',
    path: ['status'],
  });

// Unified entity schema: one file per entity, with the plan as an optional
// `### Phases` body section. Replaces the legacy pair above once migration lands.
const entityFrontmatterObjectSchema = z
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
      .enum(['note', 'fix', 'board', 'ticket'])
      .optional()
      .describe(
        '"note" marks an entity that never grows phases; "fix" is a follow-up entity linked to a done/archived parent via `idea`; "board" decomposes into "ticket" children instead of phases; "ticket" is a full entity linked back to its board via `idea`; omitted for normal ideas',
      ),
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
    released: z
      .string()
      .optional()
      .describe(
        'Version tag (e.g. v0.13.1) that first shipped this idea, stamped from the release train',
      ),
    tags: z.array(z.string()).optional().describe('Tagging categories'),
    idea: z
      .string()
      .optional()
      .describe('IDEA-N backlink to the parent this fix addresses; required when kind: fix'),
    subject: z
      .string()
      .optional()
      .describe('Subject group name; absent renders as the virtual "No subject" group'),
    order: z
      .number()
      .int()
      .optional()
      .describe('Run order; absent means unordered, sorting after ordered entries'),
    issueSource: z
      .string()
      .optional()
      .describe(
        'sourceKind:sourceKey of the Issue (IDEA-192) this entity was promoted from, if any',
      ),
  })
  .passthrough();

/**
 * Frontmatter keys the schema above assigns explicit meaning to; everything else parses
 * through untouched so an older paper-camp can carry a newer field instead of dropping it.
 */
export const entityFrontmatterKnownKeys: ReadonlySet<string> = new Set(
  Object.keys(entityFrontmatterObjectSchema.shape),
);

export const entityFrontmatterSchema = entityFrontmatterObjectSchema
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
  })
  .refine((data) => data.kind !== 'fix' || data.idea !== undefined, {
    message: 'a kind: fix entity requires an idea: link to its parent',
    path: ['idea'],
  })
  .refine((data) => data.kind !== 'ticket' || data.idea !== undefined, {
    message: 'a kind: ticket entity requires an idea: link to its board',
    path: ['idea'],
  });

export const deskServiceSchema = z.object({
  name: z.string(),
  cmd: z.string(),
  port: z.number().int().positive().optional(),
  healthcheck: z.string().optional(),
});

export const deskCheckSchema = z.object({
  name: z.string(),
  cmd: z.string(),
});

export const deskCiSchema = z.object({
  repo: z.string(),
  branch: z.string().optional(),
  releasePlease: z.boolean().optional(),
});

export const deskConfigSchema = z.object({
  services: z.array(deskServiceSchema).optional(),
  checks: z.array(deskCheckSchema).optional(),
  ci: deskCiSchema.optional(),
});

export const paperCampConfigSchema = z.object({
  version: z
    .number()
    .int()
    .describe('Corpus format version (see CORPUS_FORMAT_VERSION), not the package version'),
  projectName: z.string(),
  initializedAt: z.string(),
  nextId: z
    .object({
      // idea: unified-entity counter minting lifetime IDEA-N ids. ticket: board/ticket
      // counter (IDEA-201) minting TICKET-N ids. The rest are legacy per-kind counters.
      idea: z.number().optional(),
      ticket: z.number().optional(),
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
      feedback: agentConfigSchema,
      codeReview: agentConfigSchema,
      deskDiscovery: agentConfigSchema,
    })
    .optional(),
  desk: deskConfigSchema.optional(),
});

// notifications.log entries — JSON Lines, so a corrupt or half-written line must
// fail validation and be skipped rather than reach the inbox as a broken row.
export const storedNotificationSchema = z.object({
  id: z.string(),
  kind: z.enum(['completed', 'reply']),
  entityId: z.string(),
  entityTitle: z.string(),
  text: z.string(),
  date: z.string(),
  read: z.boolean(),
  outcome: z.enum(['done', 'error']).optional(),
});

export type PlanFields = z.infer<typeof planFieldsSchema>;
export type PlanFrontmatter = z.infer<typeof planFrontmatterSchema>;
export type IdeaFrontmatter = z.infer<typeof ideaFrontmatterSchema>;
export type EntityFrontmatter = z.infer<typeof entityFrontmatterSchema>;
