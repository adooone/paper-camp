---
id: IDEA-3
title: The Stack panel
---

### IDEA-3: The Stack panel

A persistent right-hand panel, present across every page (not a route — more like the `NavigationIsland`, but docked right and full-height), showing the active plan and a feed of recent project activity. Default open, toggleable closed.

**Look:** styled directly after paper-ui's showcase `DetailSidebar` (`src/showcase/components/detail-sidebar.tsx` in the `paper-ui` sibling repo) — the closest existing thing to "chalkboard style, full height" already built. Concretely: `position: fixed`, pinned `right`, `top: 0` to `bottom: 0`, slides in/out via `transform: translateX(...)` with a transition (not a width animation), dark chalkboard texture (`textures.ts`'s `chalkboard` — `#142e22` base + turbulence, paired with the desk-green gradient the showcase panel uses), a `Luminari`-font header with a close/toggle control, and `Caveat`-cursive uppercase labels for each content section. `Card`, `Stamp`, and `CodeBlock` all already support a `variant="chalkboard"` — log entries and status badges inside the panel should use those directly rather than inventing new dark-mode styling.

**Feature ideas, roughly in build order:**

- **Idle state — activity history** — when nothing's in progress, show a reverse-chronological log. The data already exists and is unused: `progress.md` + `/api/progress` (parsed, tested, zero consumers today — same gap the Docs page idea found). Could share a "progress feed" component with the Docs page's progress timeline, just rendered once in light theme (Docs) and once in chalkboard (here).
- **Active state — "what's in progress now"** — surface the currently in-progress plan, reusing the same `findFocusPlan` resolution logic Focus already has, plus its phase progress.
- **Live activity feed, sourced from file changes** — the honest signal for "what's happening" beyond static plan status is changes to the `papercamp/` files themselves. A file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each file's previously-parsed entries against the newly-parsed ones, can synthesize human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised") without inventing a new schema — it's narrating diffs of files that are already the source of truth.
- **Delivery mechanism** — the dev server is currently a plain `node:http` server with only request/response, no push. An SSE endpoint (`GET /api/activity/stream`, kept open, one event per detected change) is the smallest real-time addition Node's `http` module supports natively, no new dependency. Polling `/api/progress`/`/api/plans` on an interval and diffing client-side is the fallback if SSE turns out to be more plumbing than it's worth for a first version.

This whole idea is buildable from data and patterns that already exist in the codebase — no new concept of "an agent" required, just a live view of the same plan/progress state the rest of the dashboard already shows.
