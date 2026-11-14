import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readProjectConfig } from '@/core/project-config';
import type { AgentId, ChatPermissionAsk, ChatPermissionChoice } from '@/types/index';
import { resolveAgent } from './agents';
import { permissionRule } from './agents/claude-code';
import { mergePermission } from './agents/opencode';

type JsonObject = Record<string, unknown>;

async function readJsonObject(path: string): Promise<JsonObject> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${path} is not a JSON object`);
  }
  return parsed as JsonObject;
}

async function writeJsonObject(path: string, value: JsonObject): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
}

async function allowForClaudeCode(root: string, ask: ChatPermissionAsk): Promise<void> {
  const path = join(root, '.claude', 'settings.json');
  const settings = await readJsonObject(path);
  const permissions = (settings.permissions as JsonObject | undefined) ?? {};
  const allow = Array.isArray(permissions.allow) ? (permissions.allow as string[]) : [];
  const rule = permissionRule(ask);
  if (allow.includes(rule)) return;
  await writeJsonObject(path, {
    ...settings,
    permissions: { ...permissions, allow: [...allow, rule] },
  });
}

async function allowForOpencode(root: string, ask: ChatPermissionAsk): Promise<void> {
  const path = join(root, 'opencode.json');
  const config = await readJsonObject(path);
  await writeJsonObject(path, { ...config, permission: mergePermission(config.permission, [ask]) });
}

function chatAgentId(root: string): AgentId {
  return resolveAgent({ defaultAgents: readProjectConfig(root).defaultAgents, taskKind: 'chat' })
    .id;
}

export async function allowAlways(root: string, ask: ChatPermissionAsk): Promise<void> {
  if (chatAgentId(root) === 'opencode') await allowForOpencode(root, ask);
  else await allowForClaudeCode(root, ask);
}

function askLabel({ tool, target }: ChatPermissionAsk): string {
  return target ? `${tool} \`${target}\`` : tool;
}

export function permissionChoiceText(choice: ChatPermissionChoice, ask: ChatPermissionAsk): string {
  switch (choice) {
    case 'once':
      return `Allowed once: ${askLabel(ask)}. Go ahead.`;
    case 'always':
      return `Always allowed: ${askLabel(ask)}. Go ahead.`;
    case 'skip':
      return `Skip ${askLabel(ask)}. Carry on without it.`;
  }
}
