import { z } from 'zod';
import { AGENT_IDS } from '../types/index';

export const agentConfigSchema = z.preprocess(
  (v) => (typeof v === 'string' ? { agent: v } : v),
  z.object({
    agent: z.enum(AGENT_IDS),
    model: z.string().optional(),
    effort: z.string().optional(),
  }),
);

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

// ---------------------------------------------------------------------------
// Field-based schemas  (used by the monolithic `plans.md`/`decisions.md`/
// `open-questions.md` format — one file with multiple `## Heading` entries,
// each having `**Field:** value` lines below the heading.)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// YAML frontmatter schemas  (used by the per-file plan/idea format —
// one file per plan/idea, metadata in `---`-delimited YAML frontmatter,
// markdown body below.)
//
// These are the single source of truth for the per-file format. The
// field-based schemas above exist only until the migration from monolithic
// files (phase 7 of FEAT-24) is complete.
// ---------------------------------------------------------------------------

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

export const ideaFrontmatterSchema = z.object({
  id: z.string().describe('Permanent idea ID, e.g. IDEA-20'),
  title: z.string().describe('Short idea headline (3-6 words)'),
});

export const paperCampConfigSchema = z.object({
  version: z.string(),
  projectName: z.string(),
  initializedAt: z.string(),
  nextId: z
    .object({
      feat: z.number(),
      fix: z.number(),
      chore: z.number(),
      docs: z.number(),
      refactor: z.number(),
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
