## What should package.json's `./app` export actually be?

**Status:** resolved
**Raised:** 2026-06-18
**Resolved-by:** Drop the `./app` JS export; dist/app is static-only

`package.json` declares `"./app": { "import": "./dist/app/index.js" }`, implying the
dashboard is importable as a JS module (e.g. an embeddable React component). But
`vite.app.config.ts` builds it as a full SPA — `rollupOptions.input: index.html` — which
produces `dist/app/index.html` plus assets, not a `dist/app/index.js` module. The two
don't match.

Two real options: (a) drop the `./app` export entirely and treat `dist/app` as purely
static assets that `paper-camp dev` serves over HTTP, or (b) actually build a second,
separate entry that exports the root `<App />` component for embedding, alongside the
SPA build. Until this is decided, `paper-camp dev` (the CLI command) can't be finished,
since it needs to know what it's serving.

## Should `ideas.md` prose entries and `plans.md` idea-status entries be unified?

**Status:** resolved
**Raised:** 2026-06-19
**Resolved-by:** Split the sidebar's "Ideas" section into "Ideas" and "Backlog"

The Plans page's "Ideas" grouping (sidebar and list view) currently mixes two unrelated
things under one label: prose sections parsed from `ideas.md` (read-only, no fields, per
the deliberate "no schema" design below) and `plans.md` entries with `Status: idea`
(fully CRUD — created via the "Add idea" modal, deletable, editable like any other plan).
The modal's "Add idea" button creates the latter, not a new `ideas.md` section, despite
the label implying otherwise.

This wasn't a deliberate design choice — it's how the feature grew. Two real options:
(a) keep both, but split them into visually distinct groupings ("Ideas" for `ideas.md`
prose, "Backlog ideas" or similar for `Status: idea` plans), or (b) drop one concept —
e.g. stop giving plans an `idea` status and treat all loose ideas as `ideas.md` prose
until someone promotes one to a real plan. Until decided, the current behavior stays as
documented in `about.md`'s Plans page section.

## How should `paper-camp dev` serve the dashboard to an installed consumer?

**Status:** resolved
**Raised:** 2026-06-18
**Resolved-by:** `paper-camp dev` serves the dashboard via a plain http server

Local development uses `pnpm dev` (Vite's own dev server with a `configureServer` plugin
serving `/api/*`). But someone who installs `paper-camp` as a dependency has no `vite`
runtime (it's a devDependency) and no `vite.app.config.ts`/`index.html`/`src/app` in their
project — they just have `papercamp/` data and the installed package. `paper-camp dev`
needs its own plain `node:http` server that serves the *built* `dist/app` statically and
reuses `createApiMiddleware` (`src/app/server/api.ts`) against their `process.cwd()`.
Blocked on the export question above, since "what's in `dist/app`" isn't settled yet.
