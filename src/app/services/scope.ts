export const SCOPE_COLOR_TOKENS = ['blue', 'green', 'amber', 'rose', 'purple', 'slate'] as const;
export type ScopeColorToken = (typeof SCOPE_COLOR_TOKENS)[number];

/** `<slug>@<machine>`, e.g. `paper-ui@deimos` — the hub's project slug and
 * machine name, not a runtime URL (IDEA-291). */
export type ScopeKey = string;

const SEPARATOR = '@';

export function scopeKey(slug: string, machine: string): ScopeKey {
  return `${slug}${SEPARATOR}${machine}`;
}

export function parseScopeKey(key: ScopeKey): { slug: string; machine: string } | null {
  const index = key.indexOf(SEPARATOR);
  if (index <= 0 || index === key.length - 1) return null;
  return { slug: key.slice(0, index), machine: key.slice(index + 1) };
}

export function parseScopeParam(raw: string | undefined): ScopeKey[] {
  if (!raw) return [];
  const keys = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return Array.from(new Set(keys));
}

export function serializeScopeParam(keys: readonly ScopeKey[]): string | undefined {
  return keys.length > 0 ? keys.join(',') : undefined;
}

/** The current project is always in scope regardless of what `?p=` carries;
 * ticked projects from the URL join it, deduped, current project first. */
export function resolveScope(current: ScopeKey, requested: readonly ScopeKey[]): ScopeKey[] {
  const rest = Array.from(new Set(requested.filter((key) => key !== current)));
  return [current, ...rest];
}

/** Assigns each key in `hubOrder` a color from the fixed sequence by its position
 * in the whole hub listing, so a project's color stays the same regardless of
 * which other projects are ticked into scope alongside it. */
export function assignScopeColors(hubOrder: readonly ScopeKey[]): Map<ScopeKey, ScopeColorToken> {
  const colors = new Map<ScopeKey, ScopeColorToken>();
  hubOrder.forEach((key, index) => {
    colors.set(key, SCOPE_COLOR_TOKENS[index % SCOPE_COLOR_TOKENS.length]);
  });
  return colors;
}
