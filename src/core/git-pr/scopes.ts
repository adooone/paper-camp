/**
 * Valid commit scopes — keep in sync with `.commitlintrc.json`'s `scope-enum`.
 * Doubles as the area-label vocabulary Scout's PR label sync reuses (see
 * `derivePrLabels` in `pr.ts`), so a plan tag only becomes a label when it's
 * also a recognized commit scope.
 */
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
