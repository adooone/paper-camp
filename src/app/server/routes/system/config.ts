import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AGENT_IDS,
  type AgentId,
  type DefaultAgentsMap,
  type IntegrationConfig,
  type PaperCampConfig,
  TOOLBAR_SEGMENT_IDS,
  type ToolbarSegmentId,
  agentConfigsEqual,
  coerceAgentConfig,
} from '@/types/index';
import { readMaybe } from '../../helpers';
import { readBody, requestUrl, sendJson } from '../../http';
import type { Route, RouteContext } from '../types';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Repo config files the dashboard may list and read — nothing outside this set. */
const CONFIG_ALLOWLIST = [
  'biome.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'vite.config.ts',
  'vite.app.config.ts',
  'postcss.config.js',
  'package.json',
];

export async function listConfigFiles(root: string): Promise<{ files: string[] }> {
  const files: string[] = [];
  for (const name of CONFIG_ALLOWLIST) {
    const content = await readMaybe(join(root, name));
    if (content) files.push(name);
  }
  return { files };
}

export function configRoutes({ root }: RouteContext): Route[] {
  return [
    {
      method: 'POST',
      path: '/api/config',
      handle: async (req, res) => {
        const configPath = join(root, 'papercamp', 'config.json');
        const raw = await readMaybe(configPath);
        if (!raw) {
          sendJson(res, 404, { error: 'config not found' });
          return;
        }
        const body = await readBody(req);
        const bodyParsed = JSON.parse(body) as {
          port?: number;
          projectName?: string;
          defaultAgent?: AgentId;
          defaultAgents?: Record<string, unknown>;
          subjects?: unknown;
          setupDismissed?: boolean;
          integration?: {
            toolbar?: { enabled?: unknown; segments?: unknown; allowProduction?: unknown };
            route?: unknown;
          };
        };
        const { port, projectName, defaultAgent, subjects, setupDismissed, integration } =
          bodyParsed;
        const rawDefaultAgents = bodyParsed.defaultAgents;
        if (port !== undefined && (!Number.isInteger(port) || port <= 0)) {
          sendJson(res, 400, { error: 'port must be a positive integer' });
          return;
        }
        if (projectName !== undefined && projectName.trim().length === 0) {
          sendJson(res, 400, { error: 'projectName must not be empty' });
          return;
        }
        // subjects is derived from ROADMAP.md (IDEA-95) and is never written here — a
        // caller still sending it gets an explicit error rather than a silent no-op.
        if (subjects !== undefined) {
          sendJson(res, 400, { error: 'subjects is derived from ROADMAP.md and cannot be set' });
          return;
        }
        if (defaultAgent !== undefined && !AGENT_IDS.includes(defaultAgent)) {
          sendJson(res, 400, { error: 'defaultAgent must be a known agent id' });
          return;
        }
        if (setupDismissed !== undefined && typeof setupDismissed !== 'boolean') {
          sendJson(res, 400, { error: 'setupDismissed must be a boolean' });
          return;
        }
        if (rawDefaultAgents !== undefined) {
          for (const key of [
            'phase',
            'planDraft',
            'ideaExtend',
            'commitSuggest',
            'feedback',
            'codeReview',
          ] as const) {
            const val = rawDefaultAgents[key];
            const agentId =
              typeof val === 'string' ? val : (val as Record<string, unknown> | undefined)?.agent;
            if (!agentId || !AGENT_IDS.includes(agentId as AgentId)) {
              sendJson(res, 400, { error: `defaultAgents.${key} must be a known agent id` });
              return;
            }
          }
          const newPhase = coerceAgentConfig(rawDefaultAgents.phase);
          const newCodeReview = coerceAgentConfig(rawDefaultAgents.codeReview);
          if (agentConfigsEqual(newCodeReview, newPhase)) {
            sendJson(res, 400, {
              error: 'defaultAgents.codeReview must use a different model than defaultAgents.phase',
            });
            return;
          }
        }
        if (integration !== undefined && !isPlainObject(integration)) {
          sendJson(res, 400, { error: 'integration must be an object' });
          return;
        }
        if (integration?.toolbar !== undefined && !isPlainObject(integration.toolbar)) {
          sendJson(res, 400, { error: 'integration.toolbar must be an object' });
          return;
        }
        if (
          integration?.toolbar?.enabled !== undefined &&
          typeof integration.toolbar.enabled !== 'boolean'
        ) {
          sendJson(res, 400, { error: 'integration.toolbar.enabled must be a boolean' });
          return;
        }
        if (
          integration?.toolbar?.allowProduction !== undefined &&
          typeof integration.toolbar.allowProduction !== 'boolean'
        ) {
          sendJson(res, 400, { error: 'integration.toolbar.allowProduction must be a boolean' });
          return;
        }
        if (integration?.toolbar?.segments !== undefined) {
          const segments = integration.toolbar.segments;
          if (
            !Array.isArray(segments) ||
            !segments.every((s) => TOOLBAR_SEGMENT_IDS.includes(s as ToolbarSegmentId))
          ) {
            sendJson(res, 400, {
              error: `integration.toolbar.segments must only contain: ${TOOLBAR_SEGMENT_IDS.join(', ')}`,
            });
            return;
          }
        }
        if (
          integration?.route !== undefined &&
          (typeof integration.route !== 'string' || !integration.route.startsWith('/'))
        ) {
          sendJson(res, 400, { error: 'integration.route must be a path starting with /' });
          return;
        }
        const config = JSON.parse(raw) as PaperCampConfig;
        const defaultAgents: DefaultAgentsMap | undefined = rawDefaultAgents
          ? {
              phase: coerceAgentConfig(rawDefaultAgents.phase),
              planDraft: coerceAgentConfig(rawDefaultAgents.planDraft),
              ideaExtend: coerceAgentConfig(rawDefaultAgents.ideaExtend),
              commitSuggest: coerceAgentConfig(rawDefaultAgents.commitSuggest),
              feedback: coerceAgentConfig(rawDefaultAgents.feedback),
              codeReview: coerceAgentConfig(rawDefaultAgents.codeReview),
              deskDiscovery: coerceAgentConfig(rawDefaultAgents.deskDiscovery),
            }
          : undefined;
        const resolvedDefaultAgents: DefaultAgentsMap | undefined =
          defaultAgents ??
          (defaultAgent !== undefined
            ? {
                phase: { agent: defaultAgent },
                planDraft: { agent: defaultAgent },
                ideaExtend: { agent: defaultAgent },
                commitSuggest: { agent: defaultAgent },
                feedback: { agent: defaultAgent },
                codeReview: { agent: defaultAgent },
                deskDiscovery: { agent: defaultAgent },
              }
            : undefined);
        const configWithOld = config as PaperCampConfig & { defaultAgent?: AgentId };
        const { defaultAgent: _oldAgent, ...configRest } = configWithOld;
        const resolvedIntegration: IntegrationConfig | undefined = integration
          ? {
              ...config.integration,
              ...(integration.toolbar !== undefined && {
                toolbar: {
                  ...config.integration?.toolbar,
                  ...(integration.toolbar.enabled !== undefined && {
                    enabled: integration.toolbar.enabled,
                  }),
                  ...(integration.toolbar.segments !== undefined && {
                    segments: integration.toolbar.segments as ToolbarSegmentId[],
                  }),
                  ...(integration.toolbar.allowProduction !== undefined && {
                    allowProduction: integration.toolbar.allowProduction as boolean,
                  }),
                },
              }),
              ...(integration.route !== undefined && { route: integration.route as string }),
            }
          : undefined;
        const updated: PaperCampConfig = {
          ...configRest,
          ...(port !== undefined && { port }),
          ...(projectName !== undefined && { projectName: projectName.trim() }),
          ...(resolvedDefaultAgents && { defaultAgents: resolvedDefaultAgents }),
          ...(setupDismissed !== undefined && { setupDismissed }),
          ...(resolvedIntegration && { integration: resolvedIntegration }),
        };
        await writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`);
        sendJson(res, 200, { ok: true });
      },
    },

    {
      method: 'GET',
      path: '/api/configs',
      handle: async (req, res) => {
        const name = requestUrl(req).searchParams.get('name');
        if (!name) {
          sendJson(res, 200, await listConfigFiles(root));
          return;
        }
        if (!CONFIG_ALLOWLIST.includes(name)) {
          sendJson(res, 400, { error: 'invalid config file name' });
          return;
        }
        const content = await readMaybe(join(root, name));
        if (!content) {
          sendJson(res, 404, { error: 'config file not found' });
          return;
        }
        sendJson(res, 200, { name, content });
      },
    },
  ];
}
