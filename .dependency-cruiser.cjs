/**
 * Architectural consistency rules for paper-camp. Enforces the layering the repo
 * already documents (core/cli are independent of the dashboard app) and forbids
 * cycles / deep relative imports. Run via `pnpm run depcruise`.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies make modules hard to test and reason about.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-unresolvable',
      severity: 'error',
      comment:
        'A relative import that cannot be resolved is almost always a bad path. ' +
        'Scoped to relative imports (pathNot ^[^.]) — resolving third-party packages ' +
        "with exports-map/wildcard subpaths (e.g. the MCP SDK's `./server/*`) is " +
        "dependency-cruiser's weak spot and is already covered by the type-checker.",
      from: {},
      to: { couldNotResolve: true, pathNot: '^[^.]' },
    },
    {
      name: 'core-types-independent-of-app-and-cli',
      severity: 'error',
      comment:
        'The core library and shared types must not import from the app or cli layers — ' +
        'they are the foundation everything else builds on. (The cli deliberately reuses ' +
        'app/server code, so cli → app is allowed.)',
      from: { path: '^src/(core|types)/' },
      to: { path: '^src/(app|cli)/' },
    },
    {
      name: 'no-deep-relative-imports',
      severity: 'error',
      comment:
        'Avoid ../../ climbing more than one level — use the @/ alias instead ' +
        '(matches the repo import convention).',
      from: { path: '^src/' },
      to: { path: '(^|/)\\.\\./\\.\\./' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
  },
};
