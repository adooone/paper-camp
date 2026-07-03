import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { campFile, readMaybe } from '../app/server/helpers';
import { parseDecisions, parseOpenQuestions } from '../core/parser';
import { readPlansMerged } from '../core/readers';
import {
  decisionEntrySchema,
  openQuestionEntrySchema,
  parseWarningSchema,
  planEntrySchema,
} from './schemas';

function json(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  };
}

/**
 * Registers the v1 read tools, each a thin wrapper over the same `src/core`
 * readers/parsers the dashboard's `/api/*` routes call (`src/app/server/routes/reads.ts`),
 * so MCP clients see identical data shapes.
 */
export function registerReadTools(server: McpServer, root: string): void {
  server.registerTool(
    'list_plans',
    {
      title: 'List plans',
      description: 'List all plans (per-file and monolithic, merged), with parse warnings.',
      outputSchema: {
        entries: z.array(planEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = await readPlansMerged(campFile(root, 'plans'), campFile(root, 'plans.md'));
      return json({ ...result });
    },
  );

  server.registerTool(
    'get_plan',
    {
      title: 'Get plan',
      description: 'Fetch a single plan by its id (e.g. FEAT-32).',
      inputSchema: {
        id: z.string().describe('Plan id, e.g. FEAT-32'),
      },
      outputSchema: {
        entry: planEntrySchema.nullable(),
      },
    },
    async ({ id }) => {
      const { entries } = await readPlansMerged(
        campFile(root, 'plans'),
        campFile(root, 'plans.md'),
      );
      const entry = entries.find((p) => p.id === id) ?? null;
      return json({ entry });
    },
  );

  server.registerTool(
    'list_open_questions',
    {
      title: 'List open questions',
      description: 'List all open questions with their status, with parse warnings.',
      outputSchema: {
        entries: z.array(openQuestionEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = parseOpenQuestions(await readMaybe(campFile(root, 'open-questions.md')));
      return json({ ...result });
    },
  );

  server.registerTool(
    'list_decisions',
    {
      title: 'List decisions',
      description: 'List all logged decisions, with parse warnings.',
      outputSchema: {
        entries: z.array(decisionEntrySchema),
        warnings: z.array(parseWarningSchema),
      },
    },
    async () => {
      const result = parseDecisions(await readMaybe(campFile(root, 'decisions.md')));
      return json({ ...result });
    },
  );
}
