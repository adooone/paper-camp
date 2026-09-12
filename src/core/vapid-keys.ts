import { createECDH, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { machineConfigDir } from './machine-registry';

export interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

export function defaultVapidKeysPath(): string {
  return join(machineConfigDir(), 'vapid.json');
}

function isVapidKeyPair(value: unknown): value is VapidKeyPair {
  const v = value as Partial<VapidKeyPair> | null;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.publicKey === 'string' &&
    typeof v.privateKey === 'string'
  );
}

async function loadVapidKeys(path: string): Promise<VapidKeyPair | undefined> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('paper-camp: could not read VAPID keys:', error);
    }
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isVapidKeyPair(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

async function saveVapidKeys(path: string, keys: VapidKeyPair): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmpPath = `${path}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(keys, null, 2)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  await rename(tmpPath, path);
}

function generateVapidKeyPair(): VapidKeyPair {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const rawPrivateKey = ecdh.getPrivateKey();
  const privateKey = Buffer.concat([Buffer.alloc(32 - rawPrivateKey.length), rawPrivateKey]);
  return {
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: privateKey.toString('base64url'),
  };
}

export async function loadOrMintVapidKeys(path: string): Promise<VapidKeyPair> {
  const loaded = await loadVapidKeys(path);
  if (loaded) return loaded;
  const keys = generateVapidKeyPair();
  await saveVapidKeys(path, keys);
  return keys;
}
