---
id: IDEA-340
title: Current toolchain before the second desk
type: chore
status: done
created: 2026-11-16
updated: 2026-11-19
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
- [x] React 19 and zustand 5
      Bump React and its types to 19.3 and zustand to 5; fix what surfaces (refs as props, `act`, `useSyncExternalStore` selectors); check-types, lint and `pnpm test:all` green.
      run: 2m57s · 34 in · 6k out · opus-5-5 · sess:098a7e84-9904-4019-accc-7c3a46e85d2e
- [x] Vite 8 and Vitest 5
      Vite 8 with plugin-react-swc 4 across the three configs, Vitest 5 with coverage, the unit and integration projects kept; `pnpm build`, `pnpm test:all` and a `paper-camp dev` boot green.
      run: 7m1s · 84 in · 20.6k out · opus-5-5 · sess:098a7e84-9904-4019-accc-7c3a46e85d2e
- [x] Biome 2 and the remaining bumps
      `biome migrate` with the config committed; router, query, MCP SDK, zod, commander, web-push, knip, dependency-cruiser, `@types/node` 22 and the minors; all four checks green.
      run: 10m59s · 170 in · 54.4k out · opus-5-5 · sess:098a7e84-9904-4019-accc-7c3a46e85d2e

### Thread
- [ ] 2026-11-18 [question] [agent] Run-all parked on phase 1 ("React 19 and zustand 5") — the agent needs a decision: folk-ui 0.25.0 on npm still needs React ^18 and PR #52 (0.26.0) is unmerged. Wait for 0.26.0, or bump React now?
      option: Merge folk-ui release PR #52 first, then rerun this phase — follows the idea's "once folk-ui's peer range allows it"
      option: Bump React 19 now on folk-ui 0.25.0 with a peer warning — works at runtime, but the published peer range is still wrong
      option: Bump now with a temporary `peerDependencyRules.allowedVersions` — no warning, but a temporary override to remove later
      context: folk-ui's main already allows `^18.0.0 || ^19.0.0` (commit 111fbe2, IDEA-19 archived), but release-please hasn't published it yet. Merging that release PR publishes to npm, so it's not my call. The working tree already has folk-ui bumped from 0.24 to 0.25.0, which isn't my change; I left it as it is.
- [x] 2026-11-19 [question] [agent] Run-all parked on phase 1 ("React 19 and zustand 5") — the agent needs a decision: folk-ui 0.26.0 (React 19 peer range) is still unpublished; release PR #52 is open. Wait for it, or bump React now?
      option: Merge folk-ui release PR #52, then rerun this phase — follows the idea's "once folk-ui's peer range allows it"
      option: Bump React 19 now on folk-ui 0.25.0 and accept the peer warning — works at runtime, but the peer range is wrong
      option: Bump now with a temporary `peerDependencyRules.allowedVersions` — no warning, but an override to remove later
      context: folk-ui's main already allows `^18.0.0 || ^19.0.0`, but release-please hasn't published it. React 19.3.1, @types/react 19.3.0 and zustand 5.1.0 are on npm and ready. Merging the release PR publishes to npm, so it isn't my call.
- [x] 2026-11-19 [clarification] Merge folk-ui release PR #52, then rerun this phase
- [x] 2026-11-19 [chat] [agent] Got it — the answer is wait for 0.26.0, not bump React against an 18-only peer. I can't merge from this chat, so once you've merged release PR #52 and 0.26.0 is on npm, rerun phase 1: the agent bumps the folk-ui range to ^0.26.0 and takes React, react-dom, the types and zustand up in the same pass. Phases 2 and 3 don't depend on this and stay as they are.
