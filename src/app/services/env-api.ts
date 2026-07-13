import type { EnvEntry } from '@/types/index';

export interface EnvFile {
  exists: boolean;
  exampleExists: boolean;
  entries: EnvEntry[];
  missingKeys: string[];
}

export const fetchEnv = async (): Promise<EnvFile> => {
  try {
    const response = await fetch('/api/env');
    return await response.json();
  } catch {
    return { exists: false, exampleExists: false, entries: [], missingKeys: [] };
  }
};

/** `keep` preserves a set key's existing value server-side (the client never has
 *  it, since GET withholds secret values). */
export type EnvEntryInput = { key: string; value: string; keep?: boolean };

export const saveEnv = async (entries: EnvEntryInput[]): Promise<boolean> => {
  try {
    const response = await fetch('/api/env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    return response.ok;
  } catch {
    return false;
  }
};
