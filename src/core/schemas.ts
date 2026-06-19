import { z } from 'zod';

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected a YYYY-MM-DD date');

export const planFieldsSchema = z.object({
  status: z.enum(['idea', 'planned', 'in-progress', 'done', 'dropped']),
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
});

export const paperCampConfigSchema = z.object({
  version: z.string(),
  projectName: z.string(),
  initializedAt: z.string(),
});

export type PlanFields = z.infer<typeof planFieldsSchema>;
export type DecisionFields = z.infer<typeof decisionFieldsSchema>;
export type OpenQuestionFields = z.infer<typeof openQuestionFieldsSchema>;
