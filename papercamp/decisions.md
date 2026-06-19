## Split the sidebar's "Ideas" section into "Ideas" and "Backlog"

**Date:** 2026-06-19
**Status:** decided

**Context:** The Plans sidebar's "Ideas" section mixed two unrelated things: prose
sections parsed from `ideas.md` (read-only, no schema, per the storage decision below)
and `plans.md` entries with `Status: idea` (fully CRUD via an "Add idea" modal and
per-item delete). The "Add idea" button created the latter, not a new `ideas.md`
section, despite the shared label implying otherwise.

**Decision:** Kept both concepts — both are real and already used elsewhere (list view
already separates them, grouping idea-status plans under "Backlog" alongside `planned`,
and `ideas.md` prose under its own "Ideas" grid) — but split the sidebar to match: a
read-only "Ideas" section for `ideas.md` entries, and a separate "Backlog" section (with
the add/delete actions) for `Status: idea` plans. Renamed the modal from "Add idea" to
"Add to backlog" to match.

**Rationale:** Dropping either concept would lose working functionality — `ideas.md` is
the deliberate "no schema, hand-edited prose" home for raw thoughts, while idea-status
plans are deliberately lightweight, deletable plan stubs. The actual problem was only
that the sidebar (unlike list view) presented them under one label. Matching the
sidebar's grouping to list view's existing split fixes the confusion without removing
anything. Resolves the open question of the same name.

## Drop the `./app` JS export; dist/app is static-only

**Date:** 2026-06-18
**Status:** decided

**Context:** `package.json` declared `"./app": { "import": "./dist/app/index.js" }`,
implying the dashboard is importable as a JS module. But `vite.app.config.ts` builds it
as a full SPA (`index.html` + assets), not a JS module — the two never matched.

**Decision:** Removed the `./app` export entirely. `dist/app` is purely static assets,
served over HTTP by `paper-camp dev` — not imported by anything.

**Rationale:** There's no current use case for embedding the dashboard's React tree in
another app. Keeping a speculative export that doesn't match the actual build output is
worse than having no export at all. If an embeddable component is ever needed, it can be
added as its own deliberate entry later.

## Docs search lives in the nav island as a page-specific tool

**Date:** 2026-06-19
**Status:** decided

**Context:** The initial implementation placed the Docs page's full-text search input
inside the page content area, at the top of the main content column. This consumed
vertical space on every docs sub-view and felt disconnected from navigation.

**Decision:** Moved the search input to the NavigationIsland, rendered after the logo
and before the nav buttons — only visible on the `/docs` route. The query state lives
in the Zustand store so `DocsPage` can react to it. Uses the paper-ui `Input` component
for visual consistency.

**Rationale:** The nav island is the persistent chrome element present on every page;
placing page-specific tools there keeps the content area clean and establishes a pattern
for future page-specific tools (filters, toggles, etc.) without cluttering the shared
nav buttons. Disappearing the input when leaving `/docs` prevents stale queries from
showing on unrelated pages.

## `paper-camp dev` serves the dashboard via a plain http server

**Date:** 2026-06-18
**Status:** decided

**Context:** Local development uses `pnpm dev` (Vite's dev server with a
`configureServer` plugin for `/api/*`). But an installed consumer has no `vite` runtime
(devDependency only) and none of this repo's app source — just `papercamp/` data and the
installed package.

**Decision:** `src/cli/dev-server.ts` runs a plain `node:http` server: `/api/*` is handled
by `createApiMiddleware(root)` (shared with the Vite dev plugin), everything else is
served as a static file from the built `dist/app`, falling back to `index.html` for
unknown paths (SPA client-side routing). `paper-camp dev` calls this against
`process.cwd()`.

**Rationale:** No new runtime dependency, no duplicated parsing/serving logic between dev
and the installed CLI. Verified by building the package, running `dist/cli/index.js dev`
in a fresh temp project, and confirming the served HTML/JS/CSS/font assets, `/api/plans`
and `/api/config` reflecting that project's own data (not this repo's), and the SPA
fallback all work — plus a headless-browser screenshot of the Plans page rendering real
data from the built bundle.
