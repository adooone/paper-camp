import { type ScopeKey, parseScopeParam, serializeScopeParam } from './scope';

const KEY_PREFIX = 'paper-camp.lastScope:';

function keyFor(runtimeUrl: string): string {
  return `${KEY_PREFIX}${runtimeUrl}`;
}

export function rememberScope(
  runtimeUrl: string,
  keys: readonly ScopeKey[],
  storage: Storage | null,
): void {
  try {
    const value = serializeScopeParam(keys);
    if (value) storage?.setItem(keyFor(runtimeUrl), value);
    else storage?.removeItem(keyFor(runtimeUrl));
  } catch {
    // localStorage unavailable (e.g. private browsing) — degrade to in-memory only
  }
}

export function lastScopeFor(runtimeUrl: string, storage: Storage | null): ScopeKey[] {
  try {
    return parseScopeParam(storage?.getItem(keyFor(runtimeUrl)) ?? undefined);
  } catch {
    return [];
  }
}
