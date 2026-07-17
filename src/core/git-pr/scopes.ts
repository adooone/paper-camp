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
