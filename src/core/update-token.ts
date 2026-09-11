import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { machineConfigDir } from './machine-registry';

export function updateTokenPath(): string {
  return join(machineConfigDir(), 'update-token');
}

async function loadUpdateToken(path: string): Promise<string | undefined> {
  try {
    const token = (await readFile(path, 'utf-8')).trim();
    return token || undefined;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('paper-camp: could not read update token:', error);
    }
    return undefined;
  }
}

/** Mode 0600: this token is a bearer credential for POST /api/machine/update.
 * Written to a sibling temp path and renamed into place, so a crash mid-write
 * never leaves `loadUpdateToken` a truncated file to trip over. */
async function saveUpdateToken(path: string, token: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${token}\n`, { encoding: 'utf-8', mode: 0o600 });
  await rename(tmpPath, path);
}

/** Called from daemon boot and from `paper-camp update-token`, so whichever
 * runs first mints it — a missing or emptied file is a first-ever boot. */
export async function loadOrMintUpdateToken(path: string): Promise<string> {
  const loaded = await loadUpdateToken(path);
  if (loaded) return loaded;
  const token = randomBytes(32).toString('hex');
  await saveUpdateToken(path, token);
  return token;
}
