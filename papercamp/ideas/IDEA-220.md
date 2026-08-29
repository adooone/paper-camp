---
id: IDEA-220
title: Router and layout conventions pass
type: refactor
status: idea
created: 2026-08-29
tags:
  - app
  - code-health
subject: Code health
---

[[IDEA-198]]'s conventions pass, applied to the last uncovered frontend
surface: `src/app/router.tsx` and the shared `src/app/components` tree. The
feature folders are done ([[IDEA-207]]–[[IDEA-215]]); what remains is the app
chrome, and the measurements say it is the worst offender left.

`router.tsx` is 612 lines doing three jobs. `RootLayout` alone spans ~287
lines inside it — the entire app chrome (sidebar, stack panel, boot effects,
the Setup redirect) inlined into the route table — and reads the store
through 13 `useAppStore` selectors, the highest count in the app and triple
the §4 threshold. Around it sit layout machinery that belongs elsewhere:
`useMediaQuery`, the stack-open localStorage persistence, the
`SIDEBAR_WIDTH`/`STACK_WIDTH`/breakpoint constants, `navItems`, `NavLabel`,
`SidebarToggleIcon`. Its 22 comment lines mostly narrate logic the code
already states; the standard is a ~1-line non-derivable why, nothing else.

The shared components repeat the store-coupling pattern:
`stack-panel/stack-panel.tsx` reads 10 selectors, `shell/status-bar.tsx` 9 —
both are §4 violations (components render, hooks decide). The components
root also mixes concerns: three git-domain surfaces (`git-stash-surface`,
`git-sync-actions`, `commit-message-fields`) sit loose beside generic atoms
like `link-button` and `markdown`.

The settled shape:

- `src/app/components/layout/` is the one home for layout: it absorbs
  everything in `components/shell/` (which disappears) plus what leaves
  `router.tsx` — an `app-shell.tsx` holding the extracted `RootLayout`
  chrome and a `nav.ts` holding `navItems`/`NavLabel`/`SidebarToggleIcon`
  with the layout constants. depcruise names no component paths and only
  one file imports `components/shell` directly, so the move is mechanical.
- `router.tsx` keeps exactly the route table: lazy imports and `createRoute`
  definitions, with `AppShell` imported like any component. Target under
  300 lines.
- Store access moves behind hooks in `src/app/hooks/`: `use-app-shell.ts`
  (the 13 selectors plus the boot and redirect effects),
  `use-stack-panel.ts` (10), `use-status-bar.ts` (9); `useMediaQuery` and
  the stack-open persistence relocate there with their owners. The
  components keep only props and rendering.
- The git-domain trio moves to `components/git/`.
- The comment prune runs across `router.tsx` and `src/app/components`:
  keep the ~1-line non-derivable whys, delete narration.
- `docs/CODE_STYLE.md` gains the layout-folder rule and `AGENTS.md`'s
  codebase map is updated (`components/shell/` → `components/layout/`,
  router.tsx described as the route table).

Behaviour may not change. The pass ends with `pnpm check-types`, `pnpm
lint`, `npx vitest run`, and `pnpm consistency` green and no test edited to
accommodate it.

### Out of scope

Behaviour. Route structure or paths. Any change to paper-ui. The features
tree. Stores and services (their own pass if one is ever needed).

### Phases
- [ ] Extract the app shell from router.tsx into components/layout
      `app-shell.tsx` (RootLayout chrome) and `nav.ts` (nav items, icons, layout constants); router.tsx keeps only lazy imports and route definitions, under 300 lines.
- [ ] Fold components/shell into components/layout
      Move all shell files, update the barrel and the one direct import, refresh AGENTS.md's codebase map.
- [ ] Hooks own the store access
      `use-app-shell.ts`, `use-stack-panel.ts`, `use-status-bar.ts` in src/app/hooks; `useMediaQuery` and stack-open persistence move alongside; components keep rendering only.
- [ ] Group the git-domain components under components/git
      git-stash-surface, git-sync-actions, commit-message-fields, with imports updated.
- [ ] Prune narrating comments across router and components
      Keep ~1-line non-derivable whys only; reasoning goes to the commit message.
- [ ] Codify the layout rule and run the quality checks
      CODE_STYLE.md gains the components/layout rule; check-types, lint, vitest, consistency all green.
