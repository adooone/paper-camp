import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function readConfigPort(root: string): Promise<number | undefined> {
  const raw = await readFile(resolve(root, 'papercamp', 'config.json'), 'utf-8').catch(() => null);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as { port?: unknown };
    return typeof parsed.port === 'number' && Number.isFinite(parsed.port)
      ? parsed.port
      : undefined;
  } catch {
    return undefined;
  }
}

export function resolveDevPort(explicitPort: string | undefined, configPort: number | undefined) {
  return explicitPort ? Number(explicitPort) : (configPort ?? 3333);
}
