---
id: IDEA-221
title: Hub rebuild as a project picker
type: feat
status: idea
created: 2026-08-31
updated: 2026-08-31
tags:
  - app
subject: Multi-project
---

The hub screen is rebuilt from scratch. [[IDEA-219]] patched its symptoms;
the screen still reads as clutter (truncated headers colliding with buttons,
two cramped cards, four tabs of features nobody asked this screen to have),
and a repo chosen from GitHub only gets marked as chosen — there is no way
to open paper-camp for it. The hub's one job is picking a project, so the
rebuild keeps exactly that and deletes the rest.

**What goes.** The hub tabs and every cross-project view behind them —
In review, Agent activity, Ideas — are deleted: their view components,
their routes, their nav. `WelcomeScreen`, `ProjectsList`, the hub cards,
and `HubShell`'s tab bar are removed and not reused; the rebuild recreates
the screen against the confirmed wireframe. The `Layout` background
(speckle, grid) and the paper-ui visual language stay.

**The layout, as confirmed in conversation.** One parchment container,
widened to fit two columns (`max-w-3xl`), split by a center divider: the
**left column is the Projects list**, the **right column is connection**.
On narrow screens the columns stack and the divider turns horizontal.

- Left — Projects: full-width rows, one per project: name (readable, never
  truncated mid-word), address or `owner/repo` in small type beneath, a
  status stamp (Can execute / Plan only), and a `···` menu holding Rename
  and Remove so nothing competes with the click. Clicking a row opens the
  project. Empty state is one sentence.
- Right — Add a project: the GitHub block, then the runtime block. Signed
  out, GitHub is a single **Sign in with GitHub** button; the device-flow
  user-code step and the paste-a-token fallback appear only after the
  click. Connected, it is one quiet identity line with Disconnect, a
  search input, and a five-row internally-scrolling repo list where each
  row adds. The runtime block is one line: URL input plus Connect, with a
  single help sentence.

**A chosen repo becomes an openable project.** The device-local registry
(today's runtimes list plus [[IDEA-219]]'s separate hub-repo-store) unifies
into one store of project entries, each runtime-backed or GitHub-backed —
the repo store folds in and disappears. Adding a repo from the picker
creates a GitHub-backed entry in the Projects column; opening it boots the
app on the GitHub corpus source the plan-only path already uses for
unreachable runtimes, with agent, git, and every execute surface disabled.
Pairing a runtime for the same project later upgrades the row to Can
execute.

The code follows the codified conventions: hooks own store and
localStorage access, named props interfaces, comments held to the ~1-line
non-derivable why. The pass ends with `pnpm check-types`, `pnpm lint`,
`npx vitest run`, and `pnpm consistency` green.

### Out of scope

The project view itself beyond source selection (plan-only surfaces render
as they already do). The device-flow endpoints and pairing protocol.
paper-ui.

### Phases
- [ ] Delete the cross-project hub
      Remove the In review / Agent activity / Ideas views, their routes, and the hub tab bar; the hub renders one screen.
- [ ] Unify the project registry
      One device-local store of entries, runtime-backed or GitHub-backed; the hub-repo-store folds in; add, remove, rename, select work for both kinds.
- [ ] Rebuild the hub screen on the confirmed layout
      One `max-w-3xl` container, two columns with a center divider — Projects left, connection right — stacking on narrow screens; rows and blocks per the wireframe, no truncated labels, management behind `···`.
- [ ] Open GitHub-backed projects plan-only
      Entering a GitHub entry boots the GitHub corpus source with execute surfaces disabled; a paired runtime upgrades the row.
- [ ] Collapse GitHub connect to its three states
      One button signed out, the user-code step mid-flow, identity + search + five-row list connected; token paste as the post-click fallback.
- [ ] Conventions and quality checks
      Hooks own store access, named props interfaces, ~1-line whys; check-types, lint, vitest, consistency all green.
- [x] [manual] Hub rebuild as a project picker
