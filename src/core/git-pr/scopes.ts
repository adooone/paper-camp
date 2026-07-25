// Keep in sync with `.commitlintrc.json`'s `scope-enum`. Also the label vocabulary
// `derivePrLabels` (pr.ts) reuses — a tag becomes a label only if it's a recognized scope.
export const COMMIT_SCOPES = new Set([
  'core',
  'cli',
  'app',
  'server',
  'agent',
  'audit',
  'plans',
  'ideas',
  'docs',
  'settings',
  'stack',
  'ui',
  'ci',
  'config',
  'deps',
  'repo',
  'release',
  'main',
]);

/** Plan tags are free-form and may not be valid scopes; the first tag that IS one
 * wins, else `fallback` — the one rule every commit-scope/PR-title site shares. */
export function resolvePrimaryScope(tags: string[] | undefined, fallback: string): string {
  return tags?.find((tag) => COMMIT_SCOPES.has(tag)) ?? fallback;
}
