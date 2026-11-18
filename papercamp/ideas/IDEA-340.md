---
id: IDEA-340
title: Current toolchain before the second desk
type: chore
status: planned
created: 2026-11-16
updated: 2026-11-16
tags:
  - deps
  - app
needs:
  - paper-ui/IDEA-19
subject: Code health
---

The second desk (IDEA-337) would be written against React 18.3, Vite
5.4, Vitest 2.1, Biome 1.9 and zustand 4.5 while the current majors are
React 19.3, Vite 8, Vitest 5, Biome 2.6 and zustand 5.1, and the phone
already runs React 19.3. Moving first means the new client is written
once. Node 22 on the box and in `ci.yml` satisfies Vite 8 and Vitest 5;
`release.yml` and `sync-pr-metadata.yml` run on Node 20, which neither
needs. folk-ui has to allow React 19 first (paper-ui/IDEA-19).

**What moves.** `react`, `react-dom`, `@types/react` and
`@types/react-dom` to 19.3 once folk-ui's peer range allows it; `vite`
to 8 with `@vitejs/plugin-react-swc` 4 and `vite-tsconfig-paths`
current, across `vite.config.ts`, `vite.app.config.ts` and
`vite.toolbar.config.ts`; `vitest` and `@vitest/coverage-v8` to 5 with
the unit and integration projects kept as they are; `@biomejs/biome` to
2.6 through `biome migrate` with the migrated config committed and no
new rules; `zustand` to 5 (`create` without the curried call stays,
`useStore` selectors need no change, the persist middleware's storage
shape is unchanged); `@tanstack/react-router` and `react-query` to
current; `@modelcontextprotocol/sdk`, `zod`, `commander`, `web-push`,
`knip`, `dependency-cruiser` and the remaining minors. `@types/node`
goes to 22 to match the runtime, not 26. Tailwind stays on 3.4 and
TypeScript on 5.9 for the reasons in paper-ui/IDEA-19.

**What proves it.** `pnpm run check-types`, `pnpm run lint`, `pnpm
test:all` and `pnpm build` all green, the four desk checks green in the
app, the hosted build served and paired, the toolbar mounted in a
target app, and `paper-camp dev` booting the API through
`ssrLoadModule` under Vite 8.

### Phases
- [ ] React 19 and zustand 5
      Bump React and its types to 19.3 and zustand to 5; fix what surfaces (refs as props, `act`, `useSyncExternalStore` selectors); check-types, lint and `pnpm test:all` green.
- [ ] Vite 8 and Vitest 5
      Vite 8 with plugin-react-swc 4 across the three configs, Vitest 5 with coverage, the unit and integration projects kept; `pnpm build`, `pnpm test:all` and a `paper-camp dev` boot green.
- [ ] Biome 2 and the remaining bumps
      `biome migrate` with the config committed; router, query, MCP SDK, zod, commander, web-push, knip, dependency-cruiser, `@types/node` 22 and the minors; all four checks green.
