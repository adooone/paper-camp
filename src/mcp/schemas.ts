import { z } from 'zod';
import { AGENT_IDS, PLAN_KINDS, PLAN_STATUSES } from '../types/index';

/**
 * Output shapes for MCP read tools, mirroring the PlanEntry/OpenQuestionEntry/
 * DecisionEntry/ParseWarning shapes the dashboard API (`src/app/server/routes/reads.ts`)
 * already returns, so MCP clients see the same data.
 */

const logEntrySchema = z.object({
  date: z.string(),
  text: z.string(),
});

const phaseItemSchema = z.object({
  done: z.boolean(),
  text: z.string(),
  description: z.string().optional(),
  source: z.literal('review').optional(),
});

export const planEntrySchema = z.object({
  title: z.string(),
  status: z.enum(PLAN_STATUSES),
  kind: z.enum(PLAN_KINDS).optional(),
  id: z.string().optional(),
  idea: z.string().optional(),
  agent: z.enum(AGENT_IDS).optional(),
  created: z.string(),
  updated: z.string().optional(),
  audited: z.string().optional(),
  auditedHash: z.string().optional(),
  tags: z.array(z.string()),
  body: z.string(),
  phases: z.array(phaseItemSchema),
  log: z.array(logEntrySchema).optional(),
  clarifications: z.array(logEntrySchema).optional(),
});

export const openQuestionEntrySchema = z.object({
  title: z.string(),
  status: z.enum(['open', 'resolved']),
  raised: z.string(),
  resolvedBy: z.string().optional(),
  blocks: z.string().optional(),
  body: z.string(),
});

export const decisionEntrySchema = z.object({
  title: z.string(),
  date: z.string(),
  status: z.enum(['decided', 'superseded']),
  supersededBy: z.string().optional(),
  body: z.string(),
});

export const parseWarningSchema = z.object({
  title: z.string(),
  message: z.string(),
});

export const okResultSchema = z.object({
  ok: z.literal(true),
});

export const idResultSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});
