import type { EnvEntry } from '../types/index';

const ENTRY_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/;

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function quoteIfNeeded(value: string): string {
  if (value === '' || /[\s#"]/.test(value)) return `"${value.replace(/"/g, '\\"')}"`;
  return value;
}

function matchEntry(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const match = trimmed.match(ENTRY_RE);
  return match ? { key: match[1], value: unquote(match[2]) } : null;
}

export function parseEnv(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  for (const line of content.split('\n')) {
    const match = matchEntry(line);
    if (match) entries.push(match);
  }
  return entries;
}

export function applyEnvEntries(content: string, entries: EnvEntry[]): string {
  const desired = new Map(entries.map((e) => [e.key, e.value]));
  const lines = content.length > 0 ? content.split('\n') : [];
  const result: string[] = [];

  for (const line of lines) {
    const match = matchEntry(line);
    if (!match) {
      result.push(line);
      continue;
    }
    if (!desired.has(match.key)) continue;
    result.push(`${match.key}=${quoteIfNeeded(desired.get(match.key) ?? '')}`);
    desired.delete(match.key);
  }

  for (const [key, value] of desired) {
    result.push(`${key}=${quoteIfNeeded(value)}`);
  }

  while (result.length > 0 && result[result.length - 1] === '') result.pop();

  return result.length > 0 ? `${result.join('\n')}\n` : '';
}
