## Build core library: parser, schemas, scaffold, CLI

**Status:** done
**Created:** 2026-06-18
**Tags:** core, cli

Markdown parsing/serialization for plans/decisions/open-questions, zod validation,
`init`/`dev`/`add plan` CLI commands, and the missing vite build entry for the `paper-camp`
bin.

### Phases
- [x] Design and document the per-file schemas in about.md
- [x] Parser with non-fatal warnings on malformed entries
- [x] `init`/`add plan` CLI commands
- [x] Fix vite.config.ts so `dist/cli/index.js` actually gets built

## Build dashboard app

**Status:** done
**Created:** 2026-06-18
**Updated:** 2026-06-19
**Tags:** app, paper-ui

The local web dashboard (`src/app`) — Layout shell with a bottom NavigationIsland, a
dev-time API serving the papercamp/ files as JSON, and Plans/Focus/Settings views.

### Phases
- [x] Dev-time API middleware (/api/plans, /api/progress, /api/decisions, /api/open-questions, /api/config)
- [x] Router + Layout shell with nav items
- [x] Plans page reading real data from papercamp/plans.md
- [x] Settings page reading .paper-camp/config.json
- [x] Wire `paper-camp dev` (CLI) to serve a built dist/app
- [x] Drop Dashboard/Projects placeholder pages; switch nav to bottom NavigationIsland
- [x] Focus mode with phase toggling and mark-complete
- [x] Integrate paper-ui components throughout (Button, Card, Checkbox, Stamp, Progress, Textarea, ListItem, IconButton, Input, Modal, Alert)
- [x] Add rectangular blob backgrounds to paper-ui ListItem/Button for wide elements
- [x] Simplify PlansSidebar conditional rendering — only show on Plans route (done)
- [x] Add NavItem/ListItem to paper-ui showcase (done)
- [x] Clean up multi-project vestiges from data model and docs (done — single project only)
- [x] Add AI focus handoff — one-line copy-prompt per phase with plan title and phase number
- [x] Show ideas.md content in Plans page — collapsible "Ideas" section

## Add board view, plan CRUD, and project branding

**Status:** done
**Created:** 2026-06-19
**Tags:** app, plans, settings

Extended the Plans page beyond the original list-only view, added create/delete for
plan entries, and gave the dashboard a project identity (icon + name) instead of the
generic "Paper Camp" branding everywhere. Built directly in `src/app`, not recorded as
a plan at the time — this entry catches the docs up to what already shipped.

### Phases
- [x] List/board view toggle on the Plans page; board view is a read-only kanban (`in-progress`/`planned`/`idea`/`done` columns, no drag-and-drop)
- [x] Collapsible "Closed" section in list view for `done`/`dropped` plans
- [x] "Add idea" modal — `POST /api/plans` to create a new `Status: idea` entry
- [x] Delete a plan/idea entry — `DELETE /api/plans?title=...`
- [x] Render `ideas.md` prose sections (parsed client-side, split on `---`) alongside idea-status plans in the sidebar and list view's "Ideas" grouping
- [x] Project icon upload in Settings (`GET`/`POST /api/icon`, stored at `.paper-camp/assets/icon.<ext>`), shown in the nav island and Plans sidebar
- [x] Project name in nav/sidebar sourced from this repo's own `package.json` (`/api/package-name`), replacing the hardcoded "Paper Camp" fallback

## Refresh about.md technical reference

**Status:** done
**Created:** 2026-06-19
**Tags:** docs

about.md is the technical reference but has drifted from the current implementation.
Needs updating to reflect Focus page, removed Tabs usage, single-project scope, and the
current set of three pages (Plans, Focus, Settings).

### Phases
- [x] Update route/page descriptions
- [x] Remove references to removed features (multi-project, Tabs filter, container-depth issues)
- [x] Document current paper-ui component usage

## Build Docs page

**Status:** done
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, docs

A new `/docs` route surfacing project documentation that's currently invisible in the
dashboard. The highest-value slice is UI work on top of an API surface that's already
built and tested but has zero consumers: `/api/decisions`, `/api/open-questions`, and
`/api/progress`. See ideas.md's "Project docs browser" for the full feature rationale.

### Phases
- [x] Add a `/docs` route + nav entry to the bottom NavigationIsland, with a left sidebar matching `PlansSidebar`'s shape, grouped by source (Decisions, Open Questions, Progress, Repo Docs)
- [x] Decisions log view — render `decisions.md` via the existing `/api/decisions`, with a `Stamp` for `decided`/`superseded`; a `superseded` entry links to its `Superseded-by` replacement
- [x] Open questions view — render `open-questions.md` via the existing `/api/open-questions`, with a `Stamp` for `open`/`resolved`; a `resolved` entry links to its `Resolved-by` decision
- [x] Cross-link resolved questions and their deciding decisions in both directions (click through either way)
- [x] Progress timeline — render `progress.md` via the existing `/api/progress` as a reverse-chronological feed of dated entries
- [x] Add a new `/api/docs` endpoint serving general repo-root markdown (`README.md`, `CHANGELOG.md`, `LICENSE`, any others found) and a read-only "Repo Docs" section rendering it
- [x] Full-text search across decisions, open questions, progress entries, and repo docs, jumping to the matching section

## Build sidebar-driven Settings page

**Status:** planned
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, settings

Turns Settings from a single static info+icon page into a real sidebar-driven
configuration workspace, scoped to what this repo's stack actually has rather than a
generic config list. See ideas.md's "Settings page with sidebar and editable configs"
for the full feature rationale, including the write-path security boundary this needs
that the read-only Docs plan above doesn't.

### Phases
- [ ] Sidebar layout — a left rail of sections mirroring `PlansSidebar`'s structure, main area showing whichever section is selected; "General" (the existing project-info card) becomes the default landing section instead of the whole page
- [ ] Add a `GET /api/configs` endpoint that scans the repo root for config files that actually exist (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) and returns only those — never a hardcoded list
- [ ] Editable raw contents per config — selecting one loads its text in an editor area (a plain `<textarea>` to start) with a Save button
- [ ] Add the write endpoint, allowlisted to the same filenames `/api/configs` already discovered — never an arbitrary path
- [ ] Validate before writing — for JSON-shaped files (`biome.json`, `tsconfig.json`, `package.json`) parse and reject invalid JSON before it touches disk, surfaced as an inline `Alert`
- [ ] Make the "General" card's project name field editable (it's read-only today), writing back to `.paper-camp/config.json` — pairs with the icon upload already shipped

## Build the Stack — right-side status & history panel

**Status:** planned
**Created:** 2026-06-19
**Tags:** app, stack

A persistent right-docked, full-height panel present across every page, showing the
active plan and a feed of recent project activity. Default open, toggleable closed,
styled after paper-ui's showcase `DetailSidebar` (chalkboard texture, Luminari header,
Caveat section labels). See ideas.md's "The Stack — right-side status & history panel"
for the full feature rationale — entirely buildable from data/patterns already in the
codebase, no new concept of "an agent" required.

### Phases
- [ ] Panel shell — fixed right-docked, full-height, `translateX` slide transition, chalkboard texture + desk-green gradient, `Luminari` header with a toggle control, default open; added to the root layout (`router.tsx`) alongside the bottom `NavigationIsland`
- [ ] Idle state — activity history feed rendering `progress.md` via the existing `/api/progress`, reverse-chronological
- [ ] Active state — surface the currently in-progress plan, reusing the existing `findFocusPlan` resolution logic from Focus, plus its phase progress
- [ ] Live activity feed — a file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each `papercamp/` file's previously-parsed entries against newly-parsed ones, synthesizing human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised")
- [ ] Delivery mechanism — a `GET /api/activity/stream` SSE endpoint pushing one event per detected change; panel subscribes and updates live without polling
