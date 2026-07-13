import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  AGENT_IDS,
  type AgentId,
  type DefaultAgentsMap,
  type PaperCampConfig,
  coerceAgentConfig,
} from '../../../types/index';
import { readMaybe } from '../helpers';
import { readBody, requestUrl, sendJson } from '../http';
import type { Route, RouteContext } from './types';

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
    // POST /api/config — update editable fields in papercamp/config.json (port, projectName)
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
        };
        const { port, projectName, defaultAgent } = bodyParsed;
        const rawDefaultAgents = bodyParsed.defaultAgents;
        if (port !== undefined && (!Number.isInteger(port) || port <= 0)) {
          sendJson(res, 400, { error: 'port must be a positive integer' });
          return;
        }
        if (projectName !== undefined && projectName.trim().length === 0) {
          sendJson(res, 400, { error: 'projectName must not be empty' });
          return;
        }
        if (defaultAgent !== undefined && !AGENT_IDS.includes(defaultAgent)) {
          sendJson(res, 400, { error: 'defaultAgent must be a known agent id' });
          return;
        }
        if (rawDefaultAgents !== undefined) {
          for (const key of ['phase', 'planDraft', 'ideaExtend', 'commitSuggest'] as const) {
            const val = rawDefaultAgents[key];
            const agentId =
              typeof val === 'string' ? val : (val as Record<string, unknown> | undefined)?.agent;
            if (!agentId || !AGENT_IDS.includes(agentId as AgentId)) {
              sendJson(res, 400, { error: `defaultAgents.${key} must be a known agent id` });
              return;
            }
          }
        }
        const config = JSON.parse(raw) as PaperCampConfig;
        const defaultAgents: DefaultAgentsMap | undefined = rawDefaultAgents
          ? {
              phase: coerceAgentConfig(rawDefaultAgents.phase),
              planDraft: coerceAgentConfig(rawDefaultAgents.planDraft),
              ideaExtend: coerceAgentConfig(rawDefaultAgents.ideaExtend),
              commitSuggest: coerceAgentConfig(rawDefaultAgents.commitSuggest),
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
              }
            : undefined);
        const configWithOld = config as PaperCampConfig & { defaultAgent?: AgentId };
        const { defaultAgent: _oldAgent, ...configRest } = configWithOld;
        const updated: PaperCampConfig = {
          ...configRest,
          ...(port !== undefined && { port }),
          ...(projectName !== undefined && { projectName: projectName.trim() }),
          ...(resolvedDefaultAgents && { defaultAgents: resolvedDefaultAgents }),
        };
        await writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`);
        sendJson(res, 200, { ok: true });
      },
    },

    // GET /api/configs — list readable config files, or ?name=... for one file's content
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
