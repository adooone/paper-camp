import { configDefaults, defineWorkspace } from 'vitest/config';

// Everything that spawns a process or drives a real git repository — the
// slow suites the "Two moves fix the clock" plan (IDEA-242) splits out of
// the default `pnpm test` run.
const integrationTests = [
  'src/app/server/git.test.ts',
  'src/cli/daemon-lifecycle.test.ts',
  'src/app/server/agent.test.ts',
  'src/cli/registry-commands.test.ts',
  'src/mcp/tools.test.ts',
  'src/app/server/login-relay.test.ts',
  'src/app/server/routes/agent-login-relay.test.ts',
];

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'unit',
      exclude: [...configDefaults.exclude, ...integrationTests],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'integration',
      include: integrationTests,
    },
  },
]);
