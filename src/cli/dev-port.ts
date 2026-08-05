import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function readConfigJson(root: string): Promise<Record<string, unknown> | undefined> {
  const raw = await readFile(resolve(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export async function readConfigPort(root: string): Promise<number | undefined> {
  const parsed = await readConfigJson(root);
  const port = parsed?.port;
  return typeof port === 'number' && Number.isFinite(port) ? port : undefined;
}

export interface IntegrationDevConfig {
  enabled?: boolean;
  allowProduction?: boolean;
}

export async function readConfigIntegration(
  root: string,
): Promise<IntegrationDevConfig | undefined> {
  const parsed = await readConfigJson(root);
  const integration = parsed?.integration as
    | { toolbar?: { enabled?: unknown; allowProduction?: unknown } }
    | undefined;
  if (!integration) return undefined;
  const enabled = integration.toolbar?.enabled;
  const allowProduction = integration.toolbar?.allowProduction;
  return {
    enabled: typeof enabled === 'boolean' ? enabled : undefined,
    allowProduction: typeof allowProduction === 'boolean' ? allowProduction : undefined,
  };
}

export function resolveDevPort(explicitPort: string | undefined, configPort: number | undefined) {
  return explicitPort ? Number(explicitPort) : (configPort ?? 3333);
}
