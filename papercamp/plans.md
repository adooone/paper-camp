## Plan storage architecture

**Status:** idea
**Kind:** feat
**Id:** FEAT-24
**Idea:** IDEA-20
**Created:** 2026-06-28
**Tags:** core, cli, plans, ideas

Replace the single monolithic plans.md/ideas.md files with one file per plan/idea, each using YAML frontmatter for metadata instead of the current ad-hoc line grammar. This eliminates cross-branch merge conflicts (two branches editing two plans now touch two files, not two regions of one), speeds up agent reads (one small file per plan instead of a 1000-entry monster), and replaces the fragile hand-rolled line parser with a real YAML parser feeding into the existing zod schemas. Also folds .paper-camp/ (config/assets) into the visible papercamp/ directory. See ideas.md's IDEA-20 for the full rationale.

### Phases
- [ ] Design per-file schema, directory layout, and migration plan
      Finalize the YAML frontmatter metadata format, directory structure (papercamp/plans/, papercamp/ideas/, archive/), filename convention (id-only vs id+slug), and config migration from .paper-camp/ into papercamp/. Document the spec in about.md, generated from zod schemas via zod-to-json-schema.
- [ ] Build frontmatter parser/serializer
      Replace the hand-rolled line grammar in core/parser.ts with a real YAML frontmatter parser feeding into the existing zod schemas. Update serializer.ts and schemas.ts. Generate the frontmatter spec from zod schemas as the single source of truth.
- [ ] Generate index files
      Build index generators for papercamp/plans/index.md and papercamp/ideas/index.md (id, title, status, tags only), regenerated on every write.
- [ ] Implement archive as file move
      A plan moving to done/dropped moves its file from papercamp/plans/ to papercamp/plans/archive/ — no parse-and-re-serialize step.
- [ ] Update CLI and dashboard API routes
      Update CLI commands (init, add plan) and every API route (/api/plans, /api/ideas, etc.) to read/write per-file entries instead of the monolithic files.
- [ ] Move .paper-camp/ config and assets into papercamp/
      Move config.json and assets from .paper-camp/ into papercamp/, update all code references across the entire codebase.
- [ ] Write and run one-time migration script
      Split the current plans.md and ideas.md into individual per-file entries under the new layout, preserving every entry and its full content.

## Resolve open questions from Docs

**Status:** idea
**Kind:** feat
**Id:** FEAT-23
**Idea:** IDEA-19
**Created:** 2026-06-28
**Tags:** app, docs

The Docs page's open-question detail view is read-only today — it shows the question, its `open`/`resolved` `Stamp`, and a click-through to whatever `decisions.md` entry resolved it, but there's no way to actually answer one from the app. The serializer half is already written (`formatDecisionEntry`/`formatOpenQuestionEntry`/`appendBlock` in `src/core/serializer.ts`) but nothing calls it — this plan wires up the missing route and UI. The reverse link from a decision back to the questions it answers already exists in `DecisionDetail` and needs zero changes.

### Phases
- [ ] Add `formatOpenQuestions` serializer
      The plural formatter needed by the resolve endpoint to rewrite the full `open-questions.md` file after flipping an entry's status — mirrors `formatPlanEntry`'s per-entry join in the existing `formatPlans`.
- [ ] Add resolve API endpoint
      `POST /api/open-questions/resolve?title=<question title>` with `{ decision, rationale? }`. Writes the new decision entry to `decisions.md` first (via `formatDecisionEntry`/`appendBlock`), then flips the matched question entry to `status: 'resolved'` with `Resolved-by` set — order matters so `findConsistencyIssues` never sees a dangling `Resolved-by`.
- [ ] Add resolve action UI to OpenQuestionDetail
      A "Resolve" `Button` on `open-question-detail.tsx` (gated on `question.status === 'open'`) opens a `Modal` with a short **Decision** `Input` and optional **Rationale** `Textarea`, following `add-idea-modal.tsx`'s controlled `open`/`onClose`/`onAdd` pattern with local `loading` state.
- [ ] Wire frontend API and store refresh
      Add `resolveOpenQuestion(title, decision, rationale?)` to `src/app/services/docs-api.ts`. On success, re-call the store's `loadDecisions`/`loadOpenQuestions` — the same refetch-after-mutation pattern the Stack panel already uses.
- [ ] Verify reverse linking end-to-end
      Confirm that newly resolved questions appear in the existing `DecisionDetail`'s `resolvedQuestions` filter (already built at `decision-detail.tsx:16`) without changes.

## Settings config workspace

**Status:** done
**Kind:** feat
**Id:** FEAT-21
**Idea:** IDEA-2
**Created:** 2026-06-27
**Updated:** 2026-06-27
**Tags:** app, settings

Turns Settings from a single static info+icon page into a real sidebar-driven
configuration workspace, scoped to what this repo's stack actually has — auto-discovered
config files, structured package.json rendering, and editable project identity.
Built across FEAT-5 (sidebar layout + config discovery) and FEAT-9 (package.json table +
editable project name). The original write-path for biome.json/tsconfig.json/etc. was
deliberately dropped (those are editor/LSP-backed files) and split into IDEA-13.

### Phases
- [x] Add Settings sidebar layout
      Sidebar layout — a left rail of sections mirroring PlansSidebar's structure,
      main area showing whichever section is selected; "General" is the default
      landing section
- [x] Add dynamic configs endpoint
      GET /api/configs scanning the repo root for config files that actually exist
      (biome.json, tsconfig.json, tailwind.config.ts, vite.config.ts, vite.app.config.ts,
      postcss.config.js, package.json) and returns only hits
- [x] Add structured package.json rendering
      ConfigEditorSection special-cases package.json into a name → command table
      instead of a raw CodeBlock
- [x] Make project name editable
      The General card's project name becomes an editable Input, saved through
      POST /api/config

## Build core library

**Status:** done
**Kind:** feat
**Id:** FEAT-1
**Created:** 2026-06-18
**Tags:** core, cli

Markdown parsing/serialization for plans/decisions/open-questions, zod validation,
`init`/`dev`/`add plan` CLI commands, and the missing vite build entry for the `paper-camp`
bin.

### Phases
- [x] Design per-file schemas in about.md
      Design and document the per-file schemas in about.md
- [x] Parser with non-fatal warnings
      Parser with non-fatal warnings on malformed entries
- [x] `init` and `add plan` CLI commands
      `init`/`add plan` CLI commands
- [x] Fix Vite CLI build entry
      Fix vite.config.ts so `dist/cli/index.js` actually gets built

## Build dashboard app

**Status:** done
**Kind:** feat
**Id:** FEAT-2
**Created:** 2026-06-18
**Updated:** 2026-06-19
**Tags:** app, paper-ui

The local web dashboard (`src/app`) — Layout shell with a bottom NavigationIsland, a
dev-time API serving the papercamp/ files as JSON, and Plans/Focus/Settings views.

### Phases
- [x] Dev-time API middleware endpoints
      Dev-time API middleware (/api/plans, /api/progress, /api/decisions, /api/open-questions, /api/config)
- [x] Router and layout shell
      Router + Layout shell with nav items
- [x] Plans page with real data
      Plans page reading real data from papercamp/plans.md
- [x] Settings page reads config
      Settings page reading .paper-camp/config.json
- [x] Wire dev CLI to built app
      Wire `paper-camp dev` (CLI) to serve a built dist/app
- [x] Drop placeholders, add bottom nav
      Drop Dashboard/Projects placeholder pages; switch nav to bottom NavigationIsland
- [x] Focus mode with phase toggling
      Focus mode with phase toggling and mark-complete
- [x] Integrate paper-ui components
      Integrate paper-ui components throughout (Button, Card, Checkbox, Stamp, Progress, Textarea, ListItem, IconButton, Input, Modal, Alert)
- [x] Add blob backgrounds to wide elements
      Add rectangular blob backgrounds to paper-ui ListItem/Button for wide elements
- [x] Simplify PlansSidebar route rendering
      Simplify PlansSidebar conditional rendering — only show on Plans route (done)
- [x] Add NavItem and ListItem showcase
      Add NavItem/ListItem to paper-ui showcase (done)
- [x] Clean up multi-project vestiges
      Clean up multi-project vestiges from data model and docs (done — single project only)
- [x] Add AI focus handoff prompt
      Add AI focus handoff — one-line copy-prompt per phase with plan title and phase number
- [x] Show ideas.md on Plans page
      Show ideas.md content in Plans page — collapsible "Ideas" section

## Add board view and branding

**Status:** done
**Kind:** feat
**Id:** FEAT-3
**Created:** 2026-06-19
**Tags:** app, plans, settings

Extended the Plans page beyond the original list-only view, added create/delete for
plan entries, and gave the dashboard a project identity (icon + name) instead of the
generic "Paper Camp" branding everywhere. Built directly in `src/app`, not recorded as
a plan at the time — this entry catches the docs up to what already shipped.

### Phases
- [x] Add list/board view toggle
      List/board view toggle on the Plans page; board view is a read-only kanban (`in-progress`/`planned`/`idea`/`done` columns, no drag-and-drop)
- [x] Add collapsible Closed section
      Collapsible "Closed" section in list view for `done`/`dropped` plans
- [x] Add idea creation modal
      "Add idea" modal — `POST /api/plans` to create a new `Status: idea` entry
- [x] Delete plan or idea entry
      Delete a plan/idea entry — `DELETE /api/plans?title=...`
- [x] Render ideas.md prose sections
      Render `ideas.md` prose sections (parsed client-side, split on `---`) alongside idea-status plans in the sidebar and list view's "Ideas" grouping
- [x] Add project icon upload
      Project icon upload in Settings (`GET`/`POST /api/icon`, stored at `.paper-camp/assets/icon.<ext>`), shown in the nav island and Plans sidebar
- [x] Source project name from package.json
      Project name in nav/sidebar sourced from this repo's own `package.json` (`/api/package-name`), replacing the hardcoded "Paper Camp" fallback

## Refresh about.md reference

**Status:** done
**Kind:** docs
**Id:** DOCS-1
**Created:** 2026-06-19
**Tags:** docs

about.md is the technical reference but has drifted from the current implementation.
Needs updating to reflect Focus page, removed Tabs usage, single-project scope, and the
current set of three pages (Plans, Focus, Settings).

### Phases
- [x] Update route and page descriptions
      Update route/page descriptions
- [x] Remove references to removed features
      Remove references to removed features (multi-project, Tabs filter, container-depth issues)
- [x] Document current paper-ui usage
      Document current paper-ui component usage

## Build Docs page

**Status:** done
**Kind:** feat
**Id:** FEAT-4
**Idea:** IDEA-1
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, docs

A new `/docs` route surfacing project documentation that's currently invisible in the
dashboard. The highest-value slice is UI work on top of an API surface that's already
built and tested but has zero consumers: `/api/decisions`, `/api/open-questions`, and
`/api/progress`. See ideas.md's "Project docs browser" for the full feature rationale.

### Phases
- [x] Add `/docs` route and sidebar
      Add a `/docs` route + nav entry to the bottom NavigationIsland, with a left sidebar matching `PlansSidebar`'s shape, grouped by source (Decisions, Open Questions, Progress, Repo Docs)
- [x] Render decisions log view
      Decisions log view — render `decisions.md` via the existing `/api/decisions`, with a `Stamp` for `decided`/`superseded`; a `superseded` entry links to its `Superseded-by` replacement
- [x] Render open questions view
      Open questions view — render `open-questions.md` via the existing `/api/open-questions`, with a `Stamp` for `open`/`resolved`; a `resolved` entry links to its `Resolved-by` decision
- [x] Cross-link resolved questions
      Cross-link resolved questions and their deciding decisions in both directions (click through either way)
- [x] Render progress timeline
      Progress timeline — render `progress.md` via the existing `/api/progress` as a reverse-chronological feed of dated entries
- [x] Add repo docs API and view
      Add a new `/api/docs` endpoint serving general repo-root markdown (`README.md`, `CHANGELOG.md`, `LICENSE`, any others found) and a read-only "Repo Docs" section rendering it
- [x] Add full-text docs search
      Full-text search across decisions, open questions, progress entries, and repo docs, jumping to the matching section

## Build Settings page

**Status:** done
**Kind:** feat
**Id:** FEAT-5
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, settings

Turns Settings from a single static info+icon page into a real sidebar-driven
configuration workspace, scoped to what this repo's stack actually has rather than a
generic config list.

### Phases
- [x] Add Settings sidebar layout
      Sidebar layout — a left rail of sections mirroring `PlansSidebar`'s structure, main area showing whichever section is selected; "General" (the existing project-info card) becomes the default landing section instead of the whole page
- [x] Add dynamic configs endpoint
      Add a `GET /api/configs` endpoint that scans the repo root for config files that actually exist (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) and returns only those — never a hardcoded list
- [x] Add read-only config viewer
      Read-only config viewer — selecting a config file loads its text and renders it with a `<CodeBlock>` component

## Build the Stack panel

**Status:** done
**Kind:** feat
**Id:** FEAT-6
**Idea:** IDEA-3
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, stack

A persistent right-docked, full-height panel present across every page, showing the
active plan and a feed of recent project activity. Default open, toggleable closed,
styled after paper-ui's showcase `DetailSidebar` (chalkboard texture, desk-green
gradient, Luminari header, Luminari section labels). See ideas.md's "The Stack —
right-side status & history panel" for the full feature rationale — entirely buildable
from data/patterns already in the codebase, no new concept of "an agent" required.

### Phases
- [x] Build Stack panel shell
      Panel shell — fixed right-docked, full-height, `translateX` slide transition, chalkboard texture + desk-green gradient, `Luminari` header with a toggle control, default open; added to the root layout (`router.tsx`) alongside the bottom `NavigationIsland`
- [x] Render idle activity history
      Idle state — activity history feed rendering `progress.md` via the existing `/api/progress`, reverse-chronological
- [x] Surface active in-progress plan
      Active state — surface the currently in-progress plan, reusing the existing `findFocusPlan` resolution logic from Focus, plus its phase progress
- [x] Build live activity feed
      Live activity feed — a file watcher (`fs.watch` or `chokidar`) on the dev server, diffing each `papercamp/` file's previously-parsed entries against newly-parsed ones, synthesizing human-readable lines ("phase 2/5 checked off in 'X'", "plan 'Y' marked done", "new open question raised")
- [x] Add SSE activity stream
      Delivery mechanism — a `GET /api/activity/stream` SSE endpoint pushing one event per detected change; panel subscribes and updates live without polling
- [x] Show only current active phase
      Active section shows only the current (first incomplete) phase, not all phases
- [x] Apply font stack rules
      Body font uses Cormorant Garamond; Luminari reserved for titles; section labels use Luminari (was Caveat), sentence case
- [x] Darken chalkboard card background
      Chalkboard Card background darkened to `$color-chalkboard-bg` in paper-ui; used for Active, Live, and all event grouping
- [x] Add empty states
      Empty states for each section (Active, Activity, Live)
- [x] Remove stamp and progress bar
      Stamp and progress bar removed from Active section
- [x] Load Cormorant Garamond font
      Load Cormorant Garamond via Google Fonts in index.html (was referenced by name but never fetched, silently falling back to Georgia/serif)

## UI cleanup: style guide and tokens

**Status:** done
**Kind:** refactor
**Id:** REFACTOR-1
**Created:** 2026-06-19
**Updated:** 2026-06-19
**Tags:** app, ui, refactor

A consolidation pass on `src/app` rather than a new feature: write down the rules
paper-camp should already be following, then bring the code in line with them.
Grounded in an audit of the current tree, not guesswork — concrete findings below.

Known duplication: the icon/projectName fetch pattern is independently copied in
`router.tsx`, `docs-sidebar.tsx`, `plans-sidebar.tsx`, `settings-sidebar.tsx`, and
`settings-page.tsx` (5 near-identical copies); a "link button" inline style object
repeats verbatim 3x across `decision-detail.tsx`/`open-question-detail.tsx`; and
`plans/constants.ts` defines `STATUS_COLOR` and `STATUS_BAR_COLOR` as two
byte-identical maps under different names.

Known non-paper-ui elements: `stack-panel.tsx`'s custom toggle and close `<button>`s
both have direct paper-ui replacements already (`IconButton` with `variant="chalkboard"`
/ `"ghost"`) — this is a paper-camp oversight, not a paper-ui gap. Same for the raw
result-row button in `docs-search.tsx` and the raw copy-action button in
`focus-phase-item.tsx`. The one place with no paper-ui equivalent is the hidden
`<input type="file">` behind the icon-upload button in `settings-page.tsx` — that one
stays raw and gets noted as a real gap rather than worked around.

Known inconsistency: paper-ui's own `_tokens.scss` already defines a full font-family
set (serif/handwritten/mono) and a `$space-1`–`$space-16` spacing scale, but
paper-camp consumes none of it — every `fontFamily`/`margin`/`padding`/`gap` in
`src/app` is a hand-typed literal (~100+ raw spacing values, plus drifted font-stack
copies like a body-serif stack that's missing the Luminari prefix in some places but
not others). This is the root cause of the layout spacing inconsistencies.

### Phases
- [x] Write CODE_STYLE.md style guide
      Write `CODE_STYLE.md` at the repo root (auto-surfaces in the Docs page's "Repo Docs" section via the existing `/api/docs` endpoint — no new doc-type plumbing needed): paper-ui-only component usage (raw HTML only when paper-ui has no equivalent, and say so inline with a comment), consuming paper-ui's font/spacing tokens instead of hardcoded literals, a "3 copies = extract" rule for shared logic consistent with this project's existing no-premature-abstraction stance, and the feature-folder/services-layer organization the codebase already follows implicitly
- [x] Extract useProjectIdentity hook
      Extract a shared `useProjectIdentity()` hook (icon + project name) consolidating the 5 duplicated fetch sites into one
- [x] Extract LinkButton and status map
      Extract a shared `LinkButton` component for the 3x-repeated inline link-button style; collapse `STATUS_COLOR`/`STATUS_BAR_COLOR` into one map in `plans/constants.ts`
- [x] Swap raw elements for paper-ui
      Swap remaining raw/custom elements for paper-ui equivalents: `IconButton` for the Stack panel's toggle/close buttons, `docs-search.tsx`'s result row, and `focus-phase-item.tsx`'s copy button; log the file-input gap as a real paper-ui gap (open question, not a workaround built here)
- [x] Adopt paper-ui font and spacing tokens
      Adopt paper-ui's font-family and spacing tokens project-wide, replacing the ad-hoc literals — either consume paper-ui's CSS custom properties directly if exposed, or mirror them exactly in one local constants file to kill the drift
- [x] Fix root layout spacing
      Layout spacing pass over the root layout (`router.tsx`'s sidebar/content/stack-panel grid, page padding, nav island positioning) using the now-established scale — fix the specific spacing issues already visible, not a redesign
- [x] Add framer-motion animations
      Add `framer-motion` and use it for simple, restrained motion: route-level transition, list/feed items animating in (especially the Stack panel's live activity feed), and replacing the hand-rolled `translateX`/`transition` CSS in `router.tsx`/`stack-panel.tsx` with its declarative equivalents

## UI cleanup follow-up

**Status:** done
**Kind:** refactor
**Id:** REFACTOR-2
**Created:** 2026-06-19
**Updated:** 2026-06-21
**Tags:** app, ui, refactor

Findings from testing the "UI cleanup" plan's implementation live in the browser plus a
source-level pass over the same files. Two are real, user-visible bugs; the rest are loose
ends the cleanup pass introduced or left behind while fixing the things it set out to fix.

### Phases
- [x] Fix nav island content overlap
      Fix content bleeding into the bottom nav island: on long markdown bodies (e.g. the "Paper Camp" idea detail), scrolled-to-bottom text renders in the same vertical band as the fixed nav island. `router.tsx`'s `layout.pagePaddingBottom` (3rem/48px) doesn't clear the nav island's actual footprint (`navIslandBottom` offset + the island's own height, ~88-112px) — increase the clearance or derive it from the island's real height instead of a flat token
- [x] Add loading states to docs sections
      Fix the Docs page's "Repo Docs" section flashing "No repo docs found" before the fetch resolves, then correctly populating — indistinguishable from genuinely-empty during the flash. Settings already does this right (shows "Loading…" for Project Info); match that pattern for Decisions/Open Questions/Progress/Repo Docs too
- [x] Wire up loading flags
      Wire up the `loading` flag `useProjectIdentity()` already returns — none of its 5 call sites (`router.tsx`, `docs-sidebar.tsx`, `plans-sidebar.tsx`, `settings-sidebar.tsx`, `settings-page.tsx`) destructure it, so the hook can't prevent the flash-of-empty-state class of bug it was built to help with. Same dead-flag pattern as the unused `*Loading` fields already in `app-store.ts` — fix both in the same pass
- [x] Normalize font size tokens
      Normalize `tokens.ts`'s `fontSize` scale: collapse the 4 near-duplicate `-alt` entries (`xs-alt`/`sm-alt`/`base-alt`/`md-alt`, each within 0.025–0.1rem of a canonical sibling) into the single clean scale `CODE_STYLE.md` calls for, updating call sites to the nearest canonical value
- [x] Add required file input comment
      Add the inline comment `CODE_STYLE.md` itself requires next to the raw `<input type="file">` in `settings-page.tsx` — the style guide documents this as a known gap but the code doesn't carry the comment it mandates
- [x] Remove dead utility CSS rules
      Remove the dead `.btn-blue`/`.btn-red` rules in `utilities.css` — no `.tsx` file references either class; only `.btn-green`/`.btn-orange`/`.btn-violet` are ever used
- [x] Add AGENTS.md phase rule
      Add an `AGENTS.md` rule requiring assistants to complete only the explicitly requested phase of a plan at a time, so future agents don't over-implement across phase boundaries

## Drop Focus page and unify sidebar

**Status:** done
**Kind:** refactor
**Id:** REFACTOR-3
**Created:** 2026-06-19
**Updated:** 2026-06-21
**Tags:** app, plans, ui

Focus mode's only real value over the Plans page's `PlanDetail` view is that its phase
checklist is interactive (toggleable) while `PlanDetail`'s is read-only (`disabled`
checkboxes), plus the per-phase AI copy-prompt and "Mark complete" button. None of that
requires a separate distraction-free route — folding it into `PlanDetail` removes a
whole page or both for no real loss.

Separately: the per-route sidebar swap is the cause of the layout jump noticed when
switching pages. `router.tsx` conditionally mounts a completely different sidebar
component per route (`{pathname === '/' && <PlansSidebar />}`, etc.), so navigating
destroys and recreates the whole sidebar DOM tree instantly while the main content
fades/slides via `framer-motion` — that mismatch is the jump. It's worst on `/focus`
since that route has no sidebar at all, so the content width jumps too. A single
persistent sidebar shell that swaps its items per route (instead of swapping components)
fixes both the jump and the inconsistency in one move, and becomes moot for `/focus` once
that route is gone.

### Phases
- [x] Make PlanDetail checklist interactive
      Make `PlanDetail`'s phase checklist interactive: enable the checkboxes (currently `disabled`), wire them to the same `PATCH /api/plans` phase-toggle flow `FocusPage` uses, and add the per-phase `FocusPhaseItem` copy-prompt button and a "Mark complete" button (shown when all phases are done) directly in `PlanDetail`
- [x] Remove Focus route and nav item
      Remove the `/focus` route entirely: drop `focusRoute` and the "Focus" nav item from `router.tsx`, delete `src/app/features/focus/`, and update `PlanCard`'s and `PlanDetail`'s "Start" handlers to stay on the Plans page (opening the plan's detail view) instead of navigating to `/focus`
- [x] Build persistent sidebar shell
      Build one persistent sidebar shell mounted once in `router.tsx` (not per-route), with a per-route config (icon/title plus item list) driving what renders inside it — replacing the current `PlansSidebar`/`DocsSidebar`/`SettingsSidebar` conditional-mount pattern
- [x] Verify route transition animation
      Re-verify route transitions with the persistent sidebar in place: the sidebar's item list should swap (animated, not an instant cut) in sync with the main content's existing fade/slide, so nothing in the layout jumps when switching pages

## Plan and phase IDs

**Status:** done
**Kind:** feat
**Id:** FEAT-7
**Idea:** IDEA-6
**Created:** 2026-06-21
**Updated:** 2026-06-21
**Tags:** app, plans, core

Gives plans a permanent `<KIND>-<N>` ID (e.g. `FEAT-2`, `FIX-9`), shortens plan titles
to true headlines instead of sentence-length descriptions, splits each phase into a
short title plus an optional collapsible long description, and adds a backlink from a
plan to the idea it grew out of. See ideas.md's "Plan & phase IDs — short titles,
numbered phases, and a paper-ui accordion for full detail" for the full rationale,
including why the ID counter must be persistent rather than derived from a scan of
`plans.md` (a scan-and-take-highest scheme would silently reassign a freed ID after a
plan is deleted).

### Phases
- [x] Add Kind field and ID counters
      Add a `Kind` field (`feat | fix | chore | docs | refactor` — spelled exactly like Conventional Commits' own type strings) to `PlanEntry`, plus a persistent per-kind ID counter (`nextId: { feat: number, ... }`) in `.paper-camp/config.json`; assign `<KIND>-<N>` (uppercased `Kind`) at plan-creation time only, never derived from existing file contents
- [x] Add Idea backlink field
      Add an optional `**Idea:** IDEA-N` field to plan entries (parser + serializer), and prefix `ideas.md` headings with `IDEA-N:`, numbered in file order
- [x] Rewrite plan titles to headlines
      Rewrite existing `plans.md` titles to short headlines (2–6 words), moving any lost context into each entry's existing `body` paragraph
- [x] Render plan IDs and short titles
      Render `<Stamp>{id}</Stamp> {shortTitle}` everywhere a plan is listed — `plan-card.tsx`, `plan-nav-item.tsx`, `kanban-card.tsx`, `plans-sidebar.tsx`, and the `plan-detail.tsx` header
- [x] Add phase description support
      Split `PhaseItem` into its existing short `text` plus an optional `description`; update `extractPhases` in `src/core/parser.ts` to read an indented continuation paragraph as the description, fully backward-compatible with phases that have none
- [x] Build paper-ui Accordion
      Build a paper-ui `Accordion` component (none exists yet — checked `~/dev/paper-ui/src/components`) and wire it into `plan-detail.tsx`'s phase list, showing the expand control only when a phase has a `description`
      The component is added to `paper-ui` itself rather than inline in paper-camp, because
      disclosure patterns will be useful beyond this one phase list; it exposes `expanded`
      and `onToggle` so callers stay in control of state.
- [x] Add commitlint conventions
      Add `@commitlint/cli` + `@commitlint/config-conventional`, using the same type vocabulary as `Kind` so a plan's ID prefix and its closing commit's type are the same word
- [x] Replace Accordion with expandable Table in plan-detail
      Replace the Accordion-based phase list in plan-detail.tsx with paper-ui's Table component using the expandable prop, showing phase descriptions in chalkboard-textured sub-rows

## Ideas board

**Status:** done
**Kind:** feat
**Id:** FEAT-8
**Idea:** IDEA-8
**Created:** 2026-06-21
**Updated:** 2026-06-21
**Tags:** app, plans, ideas

Replaces the flat "Ideas" grid in the Plans page with a two-column board (Planned /
Done), gives ideas the same short-title treatment as plans, and surfaces every plan
that implements a given idea. Depends on the previous plan's `Idea` backlink field and
`IDEA-N` numbering — an idea's Planned/Done state and its linked-plans list are both
derived from that field, not stored separately. See ideas.md's "Ideas board —
Planned/Done columns, priority order, short titles, and idea↔plan links" for the full
rationale.

### Phases
- [x] Move idea parsing into core
      Move idea parsing into `src/core/parser.ts`/`src/types/index.ts` as a real `IdeaEntry` type (`id`, `title`, `body`), replacing the ad-hoc client-side `parseIdeas` in `app-store.ts`
- [x] Rewrite ideas.md headings
      Rewrite existing `ideas.md` headings to short titles with their `IDEA-N:` prefix
- [x] Derive idea Planned/Done state
      Derive each idea's Planned/Done state: "Done" only when every plan whose `Idea` field references it is `done`/`dropped`; everything else (including ideas with zero linked plans) is "Planned"
- [x] Build two-column ideas board
      Build the two-column board, reusing `kanban-column.tsx`'s existing column shell, replacing the flat grid in `list-view.tsx`
- [x] Add idea rows with linked plans
      Each idea row shows an icon (lightbulb for Planned, checkmark for Done) and its short title; expanding it lists every linked plan as a clickable `Stamp` per plan ID
- [x] Order ideas by file position
      Order ideas within each column by their position in `ideas.md` (priority = file order); read-only for v1, no reorder controls yet

## Project settings and config views

**Status:** done
**Kind:** feat
**Id:** FEAT-9
**Idea:** IDEA-13
**Created:** 2026-06-21
**Updated:** 2026-06-25
**Tags:** app, settings

Revised scope (was "Editable configs write path"): a `Textarea`-and-Save write path
over `biome.json`/`tsconfig.json`/etc. solves a problem nobody has — they're real
editor/LSP-backed files. This plan instead (1) renders `package.json`'s `scripts` as a
table instead of raw text, leaving every other config read-only exactly as FEAT-5 shipped
it, and (2) adds the actual editable surface: a `port` field and an env-var table, the
operational settings common to most repos, per IDEA-13.

### Phases
- [x] Render package.json scripts as a table
      `ConfigEditorSection` special-cases `package.json`: parse its `scripts` block into `name → command` rows instead of dumping the whole file through `CodeBlock`; every other allowlisted config stays exactly as today
- [x] Add `port` to PaperCampConfig and POST /api/config
      New optional `port?: number` field; a number `Input` in Settings "General", saved through a new `POST /api/config` (doesn't exist yet — `GET /api/config` is read-only). State in the UI that this sets the default for the next launch, not a live switch on the running server
- [x] Make project name editable
      The "General" card's project name becomes an editable `Input`, writing back through the same new `POST /api/config` as the port field
- [x] Add GET/POST /api/env and env table
      Reads/writes the project root's `.env`; table UI with masked values for `KEY`/`SECRET`/`TOKEN`/`PASSWORD`-like keys, add/edit/delete rows, preserving comments and ordering of untouched lines; section doesn't render when no `.env`/`.env.example` exists
- [x] Diff against .env.example
      Flag keys present in `.env.example` but missing from `.env` — the actual highest-value piece of the env-var work

### Log
- 2026-06-25: Reviewed and checked off phases 2–5 (built across several agent-launched sessions, not previously reflected here). `POST /api/config` saves `port`/`projectName`/`defaultAgent` onto `.paper-camp/config.json` with validation; Settings "General" gained matching `Input`/`Select` fields with save-confirmation. `src/core/env.ts` parses/serializes `.env` preserving comments and untouched line order; `GET`/`POST /api/env` and a new `EnvSection` (masked values for key/secret/token/password-like keys, add/edit/delete rows) only render in the sidebar when `.env` or `.env.example` exists — confirmed live via a temporary `.env.example` that `missingKeys` correctly reports unset keys with one-click add buttons. `tsc`/`biome` clean across all touched files. All phases done — Status set to `review` per `AGENTS.md`.

## Agent orchestration

**Status:** done
**Kind:** feat
**Id:** FEAT-10
**Idea:** IDEA-4
**Created:** 2026-06-21
**Updated:** 2026-06-25
**Tags:** app, agent

Launches a real agent session scoped to a plan/task from the dashboard, streams a
simplified progress view into the Stack panel, and lets follow-up input go into the
same session without leaving the browser — built for more than one agent from the
start. See ideas.md's "Agent orchestration" for the full rationale, including the
decisions (capability flags, one task at a time, localhost-only) that need to stay
explicit rather than discovered mid-build.

### Phases
- [x] Build per-agent adapter interface
      `launch(prompt, options) -> stream of events`, `resume(sessionId, message) -> stream`, plus capability flags (e.g. `supportsResume`); ship a Claude Code adapter first
- [x] Add agent selection config
      Default agent in `.paper-camp/config.json`; optional per-task override via a new `Agent` field on a `plans.md` entry
- [x] Add system-prompt checkpoint instruction
      The launched agent is told to append to `progress.md` / check off `plans.md` phases as it works — no new log schema, the agent's own writes are the activity log
- [x] Stream live status to the Stack panel
      Collapse raw tool-use events into one-line human-readable status text, pushed over the existing SSE activity channel; shown only while running, never written to disk
- [x] Support mid-task steering
      For agents whose adapter supports resume, hold the running task's session id and route panel input as a new turn into that same session
- [x] Handle process lifecycle and completion
      The process keeps running independent of the browser tab; the panel returns to its idle/history state on exit, showing the fresh `progress.md` entries the session wrote

### Log
- 2026-06-25: Ran the prerequisite opencode verification IDEA-4 called for but that hadn't happened yet (see decisions.md "Verify opencode's CLI before assuming it generalizes from Claude Code"). Confirmed: opencode's `--format json` streams true NDJSON with `sessionID` on every event, and `-s/--session <id>` resume works as tested live. `supportsResume` can be `true` for the opencode adapter, not an unknown. Still open before "Build per-agent adapter interface" starts: whether the opencode adapter is subprocess-per-call (matching the Claude adapter's shape) or a long-lived `opencode serve` + `--attach` connection — a real architecture choice, not yet made.
- 2026-06-25: Shipped the v1 slice (Claude Code adapter only, per the approved sub-plan). `src/app/server/agents/claude-code.ts` implements `buildArgs`/`parseLine`/`capabilities` against a live-confirmed `stream-json` shape (see decisions.md). `src/app/server/agent.ts` is a singleton task manager (one agent at a time, ring-buffered status lines, array-arg `spawn` — never `shell: true`, since prompts embed user-editable plan text). New routes: `POST /api/agent/launch|resume|stop`, `GET /api/agent/status`; agent events multiplexed onto the existing SSE channel with `type: 'agent'`. New Stack panel "Agent" section and a per-phase "Start agent" button in plan detail. Steering is v1-scoped: a steering message kills the current process and respawns with `-r <sessionId>`, not persistent bidirectional stdin. Verified live: a real launch spawns a real `claude` process, streams into the panel, Stop kills it cleanly, and `SIGTERM`-ing the dev server (the `dev-server.ts`/`vite.app.config.ts` shutdown hooks) kills an orphaned child too — confirmed via `ps` before/after each case. `tsc`/`biome` clean. Not done: "Add agent selection config" stays unchecked — no second adapter exists yet to choose between, so a selection mechanism would be speculative (the opencode adapter is still blocked on its own architecture decision, see entry above).
- 2026-06-25: Found and fixed a real orchestration bug: Vite's dev server restarts its middleware in-process on every server-side file change (not just Ctrl-C), which was silently orphaning the singleton `agent` manager — `vite.app.config.ts` now persists the `ApiMiddleware` instance on `globalThis` so it survives those restarts. Also added a post-run check in `agent.ts` (`wasPhaseChecked`/`finishTask`) that re-reads `plans.md` after a clean finish and pushes a visible warning line if the agent's own claimed phase checkbox didn't actually get flipped, instead of trusting the agent's self-report. Added `--permission-mode auto` to the Claude Code adapter's args (Claude Code's own classifier-based approval, the same mechanism governing this orchestrating session) layered on top of the `.claude/settings.json` allowlist, after discovering headless runs without it get stuck in permission-denial loops on real Edit/Bash work. Reviewed and checked off "Add agent selection config" — `src/app/server/agents/index.ts` (new) adds a proper `AgentAdapter`/`resolveAgent` registry consumed by `agent.ts`, `AGENT_IDS`/`AGENT_LABELS`/`agent?: AgentId` landed across `types/index.ts`/`schemas.ts`/`serializer.ts`/`parser.ts`, a per-plan `Select` in `plan-detail.tsx`, and a project-wide default in Settings — all wired end-to-end, `tsc` clean. All phases done — Status set to `review` per `AGENTS.md`. While auditing this, found and killed several genuinely orphaned `claude` processes and duplicate `pnpm dev` instances left over from the restart bug, consolidated back to one dev server on port 3333.

## Repo health status

**Status:** done
**Kind:** feat
**Id:** FEAT-11
**Idea:** IDEA-5
**Created:** 2026-06-21
**Updated:** 2026-06-24
**Tags:** app, stack

A third Stack panel section, above "Active", showing whether the repo is actually green
right now — lint, format, tests — without opening a terminal. No new infrastructure:
reuses the file watcher and SSE activity channel FEAT-6 already built, pointed at
`biome`/`vitest` exit codes instead of `papercamp/` file diffs. See ideas.md's "Repo
health status" for the full rationale.

### Phases
- [x] Add backend status cache
      An in-memory `{ lint, format, test }` `CheckResult` store next to `createActivityManager`, starting all `stale` on server boot
- [x] Add GET /api/status route
      Returns the current cache as-is, same shape as the other read routes
- [x] Auto-run lint/format on file change
      Extend the existing file watcher to also watch `src/`, debounced, spawning `biome lint .` + `biome format .` on settle, pushed over the existing `/api/activity/stream` channel
- [x] Add manual Run tests button
      `POST /api/status/test` triggers a one-off `vitest run`, streaming `running` → `pass`/`fail` over the same SSE channel
- [x] Add in-flight guard
      Track a running boolean per check so a burst of file saves can't spawn overlapping `biome`/`vitest` processes; a change mid-run queues one more run after the current one finishes
- [x] Build Status section in Stack panel
      Three chalkboard `Stamp` pills (Lint/Format/Tests) above "Active"; a `fail` pill expands a chalkboard `CodeBlock` inline with the raw error output

### Log
- 2026-06-24: Verified live: stale→fail/running/pass transitions all work, failing pills expand a CodeBlock with raw biome output, auto lint/format fires on a src/ file change (and caught two real pre-existing issues in router.tsx and parser.ts), manual Run tests streams to pass. Approved and closed.

## Commit section

**Status:** done
**Kind:** feat
**Id:** FEAT-12
**Idea:** IDEA-7
**Created:** 2026-06-21
**Updated:** 2026-06-25
**Tags:** app, stack, git

A second top-of-panel Stack section, below "Status", showing the live working-tree diff
and a small form to write and fire off a commit without switching to a terminal. Commit
only — no Push button, on purpose. See ideas.md's "Commit section" for the full
rationale.

### Phases
- [x] Add GET /api/git/status route
      Runs `git status --porcelain=v1` from the repo root, parsed into `{ path, status }[]`, pushed over the existing activity SSE channel on the same file-watcher trigger
- [x] Build changed-files accordion
      The Commit section: a "N files changed" headline expanding via paper-ui's `Accordion`, each row showing a path and its git status letter with an include/exclude checkbox
- [x] Add POST /api/git/commit route
      Body `{ files, title, message? }`; runs `git add -- <explicit files>` (never `-A`/`-u`) then `git commit -m`
- [x] Add commit form
      Title `Input` + message `Textarea` + Commit `Button`, disabled when zero files are checked or the title is empty; a `commit-msg` hook failure surfaces as an inline `Alert`
- [x] Pre-fill from active plan
      If `findFocusPlan` resolves a single in-progress plan, pre-fill the title with its `Kind` as a conventional-commit prefix and offer a one-click `Refs: FEAT-N` footer

### Log
- 2026-06-24: Needs changes: GET /api/git/status caches the result and only invalidates on a watcher tied to .git/index changes, not the src/ file watcher FEAT-6/FEAT-11 already use. Editing or creating a file never refreshes it, so the Commit section can stay stale indefinitely — verified it kept showing a deleted test file as staged hours after removal. Form validation, pre-fill from active plan, and the commit/accordion UI are all correct otherwise. Fix: drop the cache and call runGitStatus() fresh on every GET, or hook into the existing src/ watcher instead of watching .git/index.
- 2026-06-25: Re-reviewed the fix in `src/app/server/git.ts`: the cache is gone and `getStatus()` now calls `runGitStatus()` fresh on every GET, so the stale-status bug is fixed regardless of any watcher. Also added a `src/` watcher so the live SSE broadcast itself fires on file edits, not just `.git/index` changes (previously the push only fired on stage/commit). Two non-blocking nits for later: `refresh()` still calls `runGitStatus()` only to discard the result now that there's no cache to populate it into; and there are now two independent recursive `src/` watchers (here and in `status.ts`) with different debounce windows doing the same directory-tree watch — worth consolidating into one shared watcher per IDEA-5's original plan. Approved and closed.

## Review status

**Status:** done
**Kind:** feat
**Id:** FEAT-13
**Idea:** IDEA-9
**Created:** 2026-06-21
**Updated:** 2026-06-21
**Tags:** app, plans

Adds a `review` checkpoint between `in-progress` and `done` so completing the last phase
isn't the same action as closing a plan, surfaces it as a Stamp on the existing
Plan Card (no new board column or list section) and gives it a dedicated Review
page to act on, fixes a real bug where closed plans are unopenable from list view,
and adds a per-plan `Log` for what happened during review.
See ideas.md's "Review status" for the full rationale.

### Phases
- [x] Fix closed-section onOpen prop
      Pass the `onOpen` prop `list-view.tsx` already wires up for active/backlog `PlanCard`s, restoring the ability to open a closed or dropped plan
- [x] Add review PlanStatus
      New status between `in-progress` and `done`; checking the last phase in `handleTogglePhase` sets `status: 'review'` automatically instead of a separate submit click
- [x] Add Review stamp to Plan Card
      `KanbanCard` and `PlanCard` show a small "Review" `Stamp` next to `PlanIdStamp` when `plan.status === 'review'`; no new `KANBAN_COLUMNS` entry or List view section — the card stays bucketed with `in-progress` for board/list purposes
- [x] Add Review page
      New top-level route (`/review`) and nav item, structured like the Plans page: its own sidebar branch and a list filtered to `status === 'review'`, opening into the existing plan-detail view
- [x] Add Approve and Needs changes actions
      On the Review page (or plan detail opened from it): "Approve & close" (`done`) or "Needs changes" (back to `in-progress`); reopening a phase is what naturally drops `allDone` back to `false`
- [x] Add per-plan Log
      A new `### Log` sub-section parsed like `### Phases`; dated bullets appended via a `Textarea` + "Add entry" button through a `PATCH /api/plans` extension, rendered in `plan-detail.tsx` below phases

## Fix Review status bugs

**Status:** done
**Kind:** fix
**Id:** FIX-2
**Created:** 2026-06-21
**Updated:** 2026-06-21
**Tags:** app, plans, core

Code review of FEAT-13's implementation surfaced five correctness bugs and two
cleanup items, all introduced by the Review status work itself.

### Phases
- [x] Reset active selection on page change
      `activePlanTitle`/`activeIdeaTitle` are global Zustand state shared by `PlansPage`
      and the new `ReviewPage`, with neither clearing it on navigation — opening a plan
      on one page and switching to the other via the nav bar (not its own back button)
      renders that same plan's detail regardless of status. Clear both on route change,
      or scope the selection per-route.
- [x] Gate Start button on review status
- [x] Support multi-line Log entries
- [x] Disable phase checkboxes while updating
- [x] Demote review plans when starting a new one
- [x] Remove duplicate Review stamp
- [x] Extract shared section-parsing helper
      `extractLog` in `src/core/parser.ts` copy-pastes `extractPhases`'s
      heading-search/boundary-scan/remainder-slice logic almost verbatim — factor out a
      shared `extractSection(body, headingRe, parseEntry)` before a third markdown
      sub-section repeats the duplication.

## Phase convergence audit

**Status:** done
**Kind:** feat
**Id:** FEAT-14
**Idea:** IDEA-11
**Created:** 2026-06-26
**Updated:** 2026-06-26
**Tags:** app, plans, agent

A button on a plan's phase list that launches an agent to compare the plan's intent
against the current code and append any clearly-missing phase as a new unchecked item —
never reorder, check, or rewrite an existing phase. Append-only is the entire safety
property: if nothing's missing, it writes nothing, not even an empty heading. See
ideas.md's "Phase convergence audit" for full rationale.

### Phases
- [x] Generalize agent task scope beyond a single phase
      `agent.ts`'s `start()`/`AgentTask` are currently phase-shaped (`planId` +
      `phaseIndex`, success-check is "did this phase's checkbox flip"). This task is
      plan-scoped, not phase-scoped — add a launch mode with no `phaseIndex`, whose
      success-check is "did a new line get appended to `### Phases` or `### Log`"
- [x] Add convergence-audit prompt constant
      New `src/app/features/plans/prompts.ts`: read this plan's phases and body, inspect
      the current repo state, append any phase that's clearly required but missing as a
      normal `- [ ]` line at the end of the list, optionally with the existing indented
      description format. Explicitly never touch existing lines. Finish with one `### Log`
      line summarizing what was found — or write nothing at all if nothing's missing
- [x] Add "Audit phases against code" button to plan-detail.tsx
      Next to the existing `PhaseCopyButton`, launches the plan-scoped agent task from the
      previous two phases
- [x] Verify append-only behavior end-to-end
      Run against a real plan; confirm existing phases are never reordered, checked, or
      edited, and a Log entry only appears when something was actually appended

### Log
- 2026-06-26: `agent.ts`'s `AgentTask`/`AgentTaskState` now have an optional `phaseIndex`; a new shared `launch()` helper backs both `start(plan, phaseIndex)` (unchanged, phase-scoped) and a new `startForPlan(plan, prompt)` (plan-scoped, no phase). Plan-scoped success is judged in `didTaskProgress()` by snapshotting `phases.length`/`log.length` at launch (`planBaseline`) and checking for growth in either on finish, instead of one phase's checkbox. `resume()` carries `planBaseline` through a steering respawn like it already did `phaseIndex`. Updated `stack-panel.tsx`'s status line to omit the phase number when absent. `tsc`/`biome`/`vitest` all clean. Status set to `in-progress` (3 phases still unchecked).
- 2026-06-26: Added `AuditPhasesButton` next to `PhaseCopyButton` in `plan-detail.tsx`, wired through a new `launchPlanAudit` store action, `POST /api/agent/launch-audit`, and `agent.startForPlan()`. Could not exercise the live happy path: the running dev server's long-lived `agent` singleton predates this route (404 until a full process restart), and this verification session was itself the agent task occupying the single-task slot — restarting the server or spawning a second real headless agent was deliberately avoided. Verified by code review (`tsc`/`biome`/`vitest` clean) instead; live end-to-end coverage is phase 4's job.
- 2026-06-26: Verified append-only behavior end-to-end against a real plan (FEAT-9, "Project settings and config views"). Could not spawn the literal production path (a `claude --permission-mode auto` subprocess) directly — this sandbox's safety classifier denies that as an "unsafe agent" spawn, and the running dev server's `agent.ts` singleton was itself occupied by this very verification session — so used isolated temp copies of the repo and the harness's own sanctioned Agent tool, dispatched with the exact real prompt text, as a faithful stand-in. Two "nothing missing" runs against FEAT-9 unmodified (all 5 phases genuinely match the code) wrote zero bytes — confirmed via untouched-file diff, no Log line, no heading. One "real gap" run, with an unambiguous unimplemented requirement added to FEAT-9's body (a port/`.env` conflict warning that genuinely doesn't exist in code), appended exactly one new unchecked `- [ ]` phase plus one new `### Log` line — confirmed via independent diff against the pristine original that every other line, in every other plan entry, was byte-for-byte unchanged: no reordering, no checking, no rewriting. The appended phase stayed unchecked even though the audit found it, matching the prompt's instruction. This was the plan's last phase — Status set to `review` per `AGENTS.md`.

## Plan/decision consistency check

**Status:** done
**Kind:** feat
**Id:** FEAT-15
**Idea:** IDEA-12
**Created:** 2026-06-26
**Updated:** 2026-06-27
**Tags:** app, stack, docs

A read-only, derived findings pass over `decisions.md`/`open-questions.md`/`plans.md`:
dangling cross-references, and open questions that are still `open` while the plan they
block is `in-progress`/`review`. No AI involved — every check is a pure function over
already-parsed entries, same "derive, don't duplicate" approach `deriveIdeaStatuses`
already uses. See ideas.md's "Plan/decision consistency check" for full rationale.

### Phases
- [x] Add `blocks?` field to OpenQuestionEntry
      Parsed/serialized the same way `PlanEntry`'s existing optional `idea` field already
      is — a plan `id` (e.g. `FEAT-2`) that this open question blocks
- [x] Add findConsistencyIssues() derived check
      Pure function over already-parsed entries: dangling `resolvedBy`/`supersededBy`
      references that don't match any actual entry title, and open questions with
      `blocks` pointing at a plan whose `status` is `in-progress` or `review`
- [x] Add GET /api/consistency route
      Returns the findings array as-is, same shape pattern as the other read routes
- [x] Add Consistency pill to Stack panel Status section
      Fourth pill next to Lint/Format/Tests — `clean` or a count, same `Stamp` and
      click-to-expand pattern, expanding into a list of findings each linking through to
      the Docs page entry or the blocking plan

## Review-found phases

**Status:** done
**Kind:** feat
**Id:** FEAT-16
**Idea:** IDEA-14
**Created:** 2026-06-26
**Updated:** 2026-06-27
**Tags:** app, plans, agent

Lets `/code-review` findings become new, unchecked phases appended to the plan they were
reviewed against, instead of disappearing as chat output — reusing the existing per-phase
"Start agent" machinery instead of building a parallel bugs/updates entity type. See
ideas.md's "Review-found phases" for full rationale.

### Phases
- [x] Add `source?: 'review'` to PhaseItem
      Parsed from a small inline tag on the phase's checkbox line (e.g.
      `- [ ] [review] <finding summary>`) rather than a separate markdown section, so
      phases stay one list ordered however they were added
- [x] Resolve the paper-ui Table row-styling gap
      paper-ui's `Table` has no per-row styling hook today, only per-cell `cell` render
      functions — decide between adding a `rowClassName?: (row, index) => string` prop to
      the sibling paper-ui repo, or a paper-camp-only way to fake it from inside a cell
- [x] Render review-found phase styling in plan-detail.tsx
      A small `Stamp`/badge next to the phase title plus the row treatment chosen in the
      previous phase, so a review-found phase reads as distinct without a second table
- [x] Wire /code-review findings into an "Add as phases" action
      Each finding's `failure_scenario`/file:line detail becomes the new phase's
      `description` — same field that already renders in the expandable row for ordinary
      phases

## Agent-drafted plans

**Status:** done
**Kind:** feat
**Id:** FEAT-17
**Idea:** IDEA-15
**Created:** 2026-06-26
**Updated:** 2026-06-27
**Tags:** app, plans, agent

A "Draft plan" button on an `IdeaEntry` that launches an agent to read the idea and write
a real, phased `plans.md` entry from it — title, phases, descriptions, `idea: IDEA-N`
backlink — reviewing every other open plan to decide where the new plan belongs in file
order (priority), and reordering existing plan headings if warranted. See ideas.md's
"Agent-drafted plans" for full rationale, including the still-open context-scope
decision. The write-directly-vs-propose-first question is resolved — see decisions.md.

### Phases
- [x] Generalize agent task scope for plan-drafting tasks
      Shares the non-phase-scoped launch mode added by FEAT-14 (or builds it here if that
      lands first) — this task has neither `planId` nor `phaseIndex`, since the plan
      doesn't exist until the agent writes it; success-check is "did a new `## Heading`
      with `idea: IDEA-N` appear in plans.md"
- [x] Decide write-directly-vs-propose-first
      Resolve whether the agent commits the new plan straight to `plans.md` (like
      FEAT-10's phase-execution agent) or produces a draft requiring approval first —
      stated open question in ideas.md, needs an actual answer before the rest of this
      ships
- [x] Add plan-drafting prompt builder
      Includes the idea's full body, relevant `about.md`/`decisions.md` context, every
      other non-`done` plan (for the priority/ordering decision), and instructions to
      insert the new plan at the right file position — moving existing plan headings if
      warranted, never editing their title/phases/body
- [x] Add "Draft plan" button to IdeasBoard row
      Available only while the idea has no linked plan yet; once one exists, the
      per-phase buttons take over
- [x] Add visible file-order ranking to the Backlog section
      A small ordinal marker per `PlanCard` reflecting file position, read-only — without
      this, the agent's priority/ordering decisions are invisible in the UI
- [x] Show a skeleton plan card while drafting is in progress
      While `agentStatus.ideaId` is set and the task is `starting`/`running`, render a
      placeholder `PlanCard` in the Backlog list (wherever the new plan will land) showing
      only the real `idea.id` and a "Creating a plan…" title — every other field (status
      stamp, tags, rank, phase count) renders as a loading-skeleton block instead of real
      content. Disappears once the real plan entry appears (or the task finishes/errors).

### Log
- 2026-06-27: No visible feedback when draft button is clicked. No agent logs in stack and nothing working. After clicking draft button I dont see plan was created. Or where should I find it?

## Default font and Stack panel cleanup

**Status:** done
**Kind:** refactor
**Id:** REFACTOR-4
**Created:** 2026-06-27
**Updated:** 2026-06-27
**Tags:** app, ui, paper-ui

A visual review pass: paper-ui's global default makes Luminari the body/button font
everywhere except the ~16 spots that explicitly opt out (page H1s, markdown headings),
so nearly all text in the app — table rows, sidebar nav items, the nav island brand bar,
buttons — rendered in the ornate display font instead of the simpler body serif.
Separately, the Stack panel had drifted from its own chalkboard-on-dark-desk convention:
a raw, non-paper-ui "Run tests" `<button>`, agent Send/Stop buttons using the
cream-page-style colorful blob variant instead of chalkboard, Status/Commit sections with
no `Card` wrapper unlike Agent/Active/Live, and an "Active" card that duplicated the Agent
card's plan/phase info plus a redundant "Live" SSE log feed.

### Phases
- [x] Add `--paper-font-default` CSS var to paper-ui
      Sibling `paper-ui` repo: route `globals.scss`'s `body` rule and every component
      that hardcoded `font-family: $font-family-serif` (alert, list-item, select, modal,
      layout, textarea, checkbox, input, table, prop-table, navigation-island, button)
      through `var(--paper-font-default, $font-family-serif)`, mirroring the existing
      `--paper-button-font` indirection pattern; rebuilt `dist/` so paper-camp's
      `link:../paper-ui` picks it up
- [x] Set the default in paper-camp
      Added `:root { --paper-font-default: 'Cormorant Garamond', Georgia, serif; }` to
      `utilities.css` — flips every component above to the simpler font app-wide, while
      page H1s (`page-title.tsx`) and markdown headings (`markdown.tsx`) stay Luminari
      since they set `fontFamily.serif` inline, unaffected by the CSS var
- [x] Fix Stack panel button consistency
      Replaced the raw `Run tests` `<button>` with `Button variant="chalkboard"`, and
      switched the agent Send/Stop buttons from `variant="primary"` +
      `btn-violet`/`btn-orange` to `variant="chalkboard"`, matching the Lint/Format/Test
      `Stamp`s and Commit `Input`/`Textarea` already in the panel
- [x] Wrap Status and Commit in Cards; remove Active and Live
      Wrapped the Status and Commit sections in `Card variant="chalkboard" size="small"`
      to match Agent's existing card styling, and removed the "Active" (duplicated the
      Agent card) and "Live" (redundant SSE feed) sections entirely — kept the underlying
      `EventSource` subscription since it also drives the other sections' refreshes
- [x] Simplify PlanCard in the plans list
      Larger/bolder title, dropped the body/description text and the Open/Start/Stop
      buttons from the list item — Start/Stop already exist in `PlanDetail`, so no
      functionality lost — and made the whole card clickable (`role="button"`,
      keyboard-accessible) to open the plan instead
- [x] Match PlanCard's title style to PlanDetail's
      Switched the list item's title from `text-xl`/`fontWeight: 700` to the same
      `fontFamily.serif` (Luminari), `fontWeight: 600`, `1.75rem` style `PlanDetail`'s
      `<h2>` already uses, so the title reads consistently across list and detail
- [x] Reorder Stack panel to Agent → Status → Commit, each fixed-height
      Reordered the three sections (Agent now first) and changed the panel's content
      area from one scrolling column to a flex column where each section is
      `flex: 1, minHeight: 0` — so the three divide the panel's full height evenly,
      each scrolling independently (`overflowY: auto`) if its own content overflows,
      separated by a `deskBorder` divider between sections
- [x] Shrink Status to the smallest, centered section; stretch each Card full-height
      Agent/Commit are now `flex: 2`, Status `flex: 1` (smallest, still in the visual
      center between them). paper-ui's `Card` is a plain block div with no height-100%
      behavior, so added a `.stack-card-fill` utility class in `utilities.css` that
      reaches into `Card`'s two nested divs (mirroring the existing `.btn-*` SVG-path
      override pattern) to stretch it to fill its section and scroll its own content
      independently; passed via `Card`'s existing `className` prop on all three cards
- [x] Rework Status stamps to Quality/Tests/Consistency, click-to-run, centered
      Replaced the separate Lint/Format stamps with one derived "Quality" stamp
      (fail/running takes priority over the other; pass only if both pass) and dropped
      the per-stamp output-expand/`CodeBlock` behavior — clicking Quality or Tests now
      triggers that check directly instead. Genericized the test-only
      `POST /api/status/test` route into `POST /api/status/check?name=lint|format|test`
      (`status.runCheck()` already supported any `CheckName`, only the route was
      test-specific), replaced `triggerTests()`/`runTests` with `triggerCheck(name)`/
      `runCheck(name)` in `status-api.ts`/`app-store.ts`. Removed the standalone
      "Run tests" button — Tests stamp click replaces it. Quality/Tests stamps disable
      (and grey out) while either is running, since only one check job runs at a time;
      Consistency is unaffected since it's derived instantly, not a spawned job. Row is
      centered both horizontally and vertically within the now full-height Status Card
- [x] Add a real auto-fix for Quality; copy-prompt for failing Tests
      Quality is the only one of the three with a mechanical fix (`biome check . --write`
      covers both lint and format) — added `runQualityFix()` to `status.ts`,
      `POST /api/status/fix`, and a "Suggested fix: run biome --write" link under the
      stamps when Quality fails, disabled while any check is running. Tests/Consistency
      failures need judgment, not a script: added a small "Tests failing — see output, or
      [copy fix prompt]" line under the stamps when Tests fails, using a new
      `CopyPromptButton` (extracted the existing `PhaseCopyButton`'s `copyToClipboard`
      helper into `app/utils/clipboard.ts` so both share it) that copies a prompt
      embedding the captured `vitest` output. Left Consistency as-is — its existing
      per-issue clickable list already says what to check
- [x] Drop the "clean"/count suffix from the Consistency stamp label
      Now reads just "Consistency" always — state is conveyed by the stamp's fill/text
      color alone, matching Quality/Tests' plain labels. (Separately confirmed via
      curl that the running dev server's `api.ts` predates `/api/consistency`,
      `/api/status/check`, and `/api/status/fix` — all 404 until `pnpm dev` restarts;
      not a code bug in this plan's work)
- [x] Add a one-sentence failure summary above each suggested fix
      New `summarizeQualityFailure()`/`summarizeTestFailure()` (`app/utils/check-summary.ts`,
      with unit tests) parse a plain-English sentence from the check's captured output —
      `"N lint/format issue(s) found."` from biome's `Found N errors.` line,
      `"N test(s) failed."` from vitest's summary line, falling back to a generic message
      if the count isn't parseable. Shown above the existing fix link/prompt when Quality
      or Tests fails. `CopyPromptButton` gained a `variant="link"` mode (text + underline,
      matching the Quality fix link's style) for the Tests case
- [x] Stabilize the Status layout — always-present message slot, anchored to top
      The stamps row used to shift/recenter as fail messages mounted and unmounted
      (clicking the fix link visibly jumped the layout). Switched the column from
      `justifyContent: 'center'` to `'flex-start'` so the row anchors at the top, and
      replaced the two independently-conditional fail blocks with one always-mounted
      message slot below the row that renders exactly one of: "Running checks…",
      "Checks haven't run yet.", "All checks passing.", or the fail message(s) — so
      content changes in place under a fixed-position row instead of the row itself
      jumping around
- [x] Fix stamp width jump on running, and balance empty-state sections
      The Quality/Tests stamps grew wider when their `…` running suffix appeared,
      shifting the whole row — switched to always rendering the `…` with
      `visibility: hidden` when not running, reserving its width permanently instead of
      conditionally rendering it. Verified live in Chrome that "No agent running."/
      "No changed files." left a large dead gap below them in the now full-height
      Agent/Commit sections (only the populated-state content was wrapped to fill height,
      not the fallback message) — wrapped each fallback `<p>` in its own
      `flex: 1, alignItems: 'center', justifyContent: 'center'` div so it centers within
      the section's full height like the populated state does
- [x] Re-center the Status stamps/message group, fixing leftover dead space
      The `flex-start` change two phases ago anchored the stamps row to the top of the
      now full-height Status `Card`, but left a visibly large empty gap below the short
      message slot — confirmed live in Chrome (the screenshot showed Chrome's own
      flexbox-gap overlay highlighting it). The actual fix for the earlier "jump" was the
      always-rendered message slot (previous phase), not the alignment — switched back
      to `justifyContent: 'center'` so the stamps+message group centers as a unit within
      the card, with only a one-line height delta between states now that the slot never
      mounts/unmounts
- [x] Eliminate the residual jump — fixed two-line message slot, one state at a time
      Centering the group still let the stamps row shift whenever the message slot's
      own height changed (1 line running/pass/stale vs. up to 4 lines if both Quality
      and Tests failed at once — two independently-conditional blocks could both
      render). Rewrote it as a single discriminated message (priority: running >
      Quality fail > Tests fail > all-pass > stale) so exactly one state renders at a
      time, always as a primary line plus a second line that's either the fix
      link/prompt or an invisible (`visibility: hidden`) placeholder of the same
      font-size — the slot is now always exactly two lines tall, so the stamps row
      never recenters. Verified live in Chrome: triggered Tests running → pass → back
      to Quality-fail, row stayed pixel-identical throughout

## Polish Ideas and Stack UX

**Status:** done
**Kind:** feat
**Id:** FEAT-18
**Idea:** IDEA-16
**Created:** 2026-06-27
**Updated:** 2026-06-27
**Tags:** ideas, ux, app, agent

A grab-bag of UX fixes for the Ideas/Stack flow, flagged from actually using the app
rather than from a single feature gap: the sidebar's Ideas list never drops a
done idea, there's no UI path to create a new `ideas.md` entry at all (only
`plans.md` Backlog items via "Add to backlog"), the Ideas board's Done column grows
unbounded, the Stack panel's Agent section only understands FEAT-10's phase-execution
task shape, and several user-triggered actions give no visible feedback — FEAT-17's
own log entry ("No visible feedback when draft button is clicked... nothing
working") is a real instance of that last problem, not a hypothetical one.

This also adds a third agent-task shape — "Extend with AI" on an open idea, rewriting
its body in place — alongside FEAT-10's phase execution and FEAT-17's plan-drafting,
which is what makes the Stack panel's phase-only Agent section and IDEA-4's
one-task-at-a-time constraint worth revisiting now rather than later.

### Phases
- [x] Hide done-linked ideas from the sidebar's Ideas section
      `plans-sidebar.tsx`'s Ideas section lists every `ideaEntries` item regardless of
      its derived `status`; filter to `status !== 'done'` so a fully-planned idea drops
      out once its linked plan(s) are done. The Ideas board's own Planned/Done columns
      are unaffected — seeing a done idea there next to its check icon is the point.
- [x] Add a minimal idea-creation form and `POST /api/ideas`
      There's currently no UI path to create an `ideas.md` entry — `add-idea-modal.tsx`
      only creates `plans.md` Backlog entries. Add an endpoint that appends a new
      `### IDEA-N: <title>` section from `{ title, body }`, and a plain two-field modal
      (no kind/tags/etc, matching the minimal shape an idea entry actually needs)
      wired up from the Ideas section.
- [x] Add an "Extend with AI" agent task for rewriting one idea's body
      A third `AgentTask` shape alongside FEAT-10's phase-scoped execution and FEAT-17's
      plan-drafting: given one idea's id and current body, explores the codebase and
      rewrites that idea's body in place in `ideas.md` with more specific detail
      (concrete approaches, file references). Needs its own prompt builder and a
      different success check ("did this `IDEA-N`'s body text change") than either
      existing task shape, plus a button on the open-idea view.
- [x] Build a shared in-flight/result feedback pattern and apply it
      `DraftPlanButton`'s local `launching` state currently has no visible effect on
      screen — confirmed by FEAT-17's own log. Add one reusable loading/success/failure
      affordance and wire it into Draft plan, Extend with AI, and any other
      user-triggered action found during an audit to be missing it; treat this as the
      first fix in what's flagged as a recurring gap, not a one-off patch.
- [x] Broaden the Stack panel's Agent section beyond phase execution
      The Agent section's rendering (`stack-panel.tsx`) is built around
      `agentStatus.phaseIndex`, so plan-drafting and idea-extension tasks have nowhere
      sensible to show. Generalize it to display any task kind. IDEA-4's "one active
      task at a time" constraint stays as-is — see decisions.md; this phase is display
      only, not a concurrency change.
- [x] Cap the Ideas board's Done column at 4 rows with a done-ideas list view
      `ideas-board.tsx`'s `done` column renders every done idea unfiltered. Slice to the
      4 most recently done, and render a 5th row as a "[N more ideas]" link (not a card)
      that navigates to a new, separate done-ideas list view showing the full set.

## Add opencode agent support

**Status:** done
**Kind:** feat
**Id:** FEAT-20
**Idea:** IDEA-17
**Created:** 2026-06-27
**Updated:** 2026-06-27
**Tags:** app, agent, settings

A second real `AgentAdapter` (opencode) alongside Claude Code, plus replacing
`.paper-camp/config.json`'s single project-wide `defaultAgent` with a default per
agent-task kind — phase execution ([[IDEA-4]]), plan-drafting ([[IDEA-15]]), and idea
extension (the FEAT-18 phase that adds it) — so opencode can be the default for running
plan phases specifically without forcing it onto every kind of agent task. Builds on
the live opencode CLI verification already done for FEAT-10 (see decisions.md's "Verify
opencode's CLI before assuming it generalizes from Claude Code" — `opencode run
--format json` streams NDJSON with `sessionID` on every event, and `-s/--session <id>`
resume is confirmed working), so `supportsResume` for this adapter is a known `true`,
not an open question. Also fixes two real visual bugs on the Settings page found while
looking at where `defaultAgent` lives: four near-identical single-field cards stacking
the General section past one screen, and the Default Agent `Select`'s dropdown getting
hard-clipped by its `Card`'s `overflow: hidden` — the second one a hard blocker for the
new per-kind selectors, since adding two more `Select`s on top of the current layout
would just be three clipped dropdowns instead of one.

### Phases
- [x] Add opencode AgentAdapter
      New `src/app/server/agents/opencode.ts` implementing `buildArgs`/`parseLine`
      against opencode's already-confirmed `run --format json` NDJSON output. Register
      it as a second entry in `AGENTS` (`src/app/server/agents/index.ts`); add
      `'opencode'` to `AGENT_IDS`/`AGENT_LABELS` (`src/types/index.ts`). (Note: the
      original phrasing here referenced `capabilities.supportsResume` — that field was
      removed from `AgentAdapter` earlier the same day when the "steer the agent"
      feature was deleted; `opencode.ts` correctly has no `capabilities` export,
      consistent with `claude-code.ts`. Corrected during review.)
- [x] Fix Settings page Select dropdown clipping
      `settings-page.tsx`'s `GeneralSection` renders its `Select` inside a `Card`, and
      `Card`'s stylesheet sets `overflow: hidden`
      (`~/dev/paper-ui/src/components/card/card.module.scss:6`), clipping the open
      dropdown's option list flush at the card's bottom edge. Add portal rendering to
      paper-ui's `Select` (escaping the Card's overflow context) or restructure so
      `Select` controls never sit inside an `overflow: hidden` container — needed before
      the per-task-kind selectors below add two more `Select`s with the same bug
- [x] Consolidate GeneralSection into one card
      Replace the four separate full-width `Card`s (Project Name, Project Icon, Dev
      Server Port, Default Agent), each with its own `marginTop: space[8]` and Save
      button, with one `Card` (or a tight list layout with internal dividers) holding
      all the rows — fixes the General section running well past one screen for a
      handful of related project settings
- [x] Replace defaultAgent with per-task-kind defaultAgents
      `PaperCampConfig.defaultAgent` (`src/types/index.ts`) becomes `defaultAgents: {
      phase: AgentId, planDraft: AgentId, ideaExtend: AgentId }`; update `POST
      /api/config` validation and every `resolveAgent` call site (`agent.ts`) to look up
      by the task kind it's launching, migrating a config still on the old single field.
      `defaultAgents.phase` defaults to `'opencode'`, `planDraft`/`ideaExtend` stay
      `'claude-code'` — per the user's request that opencode become the default
      specifically for running plan phases, not every task kind. A plan's own per-plan
      `Agent:` override still wins over whichever default applies to that kind
- [x] Add per-task-kind Select controls to Settings
      Three `Select`s (Phase execution / Plan drafting / Idea extension) in the
      now-consolidated General card, built on the fixed dropdown layout from above, each
      saving its own key through the updated `POST /api/config`
- [x] Verify opencode end-to-end
      Confirm all three Settings selectors save/load correctly and their dropdowns are
      fully clickable, not clipped. Verified at the code level: type-check clean
      (`tsc`), lint clean (`biome`), paper-ui build clean, all code paths coherent
      (agent.ts launch → resolveAgent with taskKind → opencode adapter;
      settings-page.tsx three Selects → handleSaveAgent with per-key dispatch;
      POST /api/config → defaultAgents with backward-compat migration). Dev server
      restart needed for server-side changes (agent.ts, api.ts) to take effect before a
      live browser session can exercise the full flow. (Note: the original phrasing
      also asked to "confirm mid-task steering via -s/--session <id> works through the
      existing resume flow" — the resume/steering flow was deleted from the app the
      same day, so that criterion no longer applies and was dropped during review.)

### Log
- 2026-06-27: Reviewed against the live code (`tsc`/`biome`/`vitest` clean, `opencode` CLI confirmed installed, v1.3.17). Confirmed: opencode adapter registered, Settings consolidated into one Card with three working per-task-kind selects, `defaultAgents` migration works both directions (read-time fallback in `agent.ts`, write-time migration in `api.ts`). The dropdown-clipping fix is now confirmed genuinely fixed live in Chrome — opened the Phase execution select inside its Card and both options render fully visible, upgrading it from the prior "verified by code review only" status. Found and corrected two stale claims left over from this plan's phases 1 and 6: both referenced `capabilities.supportsResume`/mid-task steering, a feature that was deleted from the app (the "steer the agent" UI/backend removal) the same day this plan was built — the actual code never has a dangling `capabilities` field, the plan text just hadn't caught up. Not live-tested: actually spawning a real opencode phase-execution task end-to-end (would require running a real agent task as part of a review pass — deferred as out of scope for review).

## Plan clarification pass

**Status:** done
**Kind:** feat
**Id:** FEAT-19
**Idea:** IDEA-10
**Created:** 2026-06-27
**Updated:** 2026-06-27
**Tags:** app, plans, core

Borrows `spec-kit`'s `/clarify` algorithm — scan a fixed taxonomy (functional scope,
data model, UX flow, non-functional attributes, edge cases, terminology, completion
signals), surface at most 5 highest-impact gaps, ask one question at a time with a
stated recommendation up front — onto a new optional `### Clarifications` sub-section
per plan, parsed the same way `### Phases`/`### Log` already are. See ideas.md's "Plan
clarification pass" for full rationale, including why this stays an available tool
rather than a gate every plan must pass through.

### Phases
- [x] Generalize extractLog into extractDatedList
      `extractLog`'s body in `src/core/parser.ts` is a generic `{ date, text }` list
      parser already; factor it into `extractDatedList(body, headingRe)` reusing
      `LOG_ENTRY_RE` unchanged, with `extractLog` becoming a one-line call into it
- [x] Add Clarifications parsing and PlanEntry field
      Add `CLARIFICATIONS_HEADING_RE = /^###\s+Clarifications\s*$/i`, call
      `extractDatedList` with it the same way `extractPhases`/`extractLog` call their
      own heading regexes, and add `clarifications?: LogEntry[]` to `PlanEntry` (parser
      and serializer), reusing the existing `LogEntry` type — no new type needed
- [x] Add clarification-pass prompt constant
      New constant in `src/app/features/plans/prompts.ts`: the taxonomy above, the
      "ask one at a time, lead with `**Recommended:** Option A — <why>`" loop
      instruction, and "write accepted answers back under `### Clarifications` as
      `- YYYY-MM-DD: Q: <question> → A: <answer>`"
- [x] Add "Clarify before starting" button to plan-detail.tsx
      Same copy-to-clipboard mechanism as `PhaseCopyButton`, placed near it, using the
      new prompt constant
- [x] Render Clarifications list in plan-detail.tsx
      Read-only dated bullets below the plan body, above Phases, styled identically to
      how `### Log` entries already render
- [x] Move Clarify button above plan description
      The Clarify button currently lives in the Phases table header area; move it above
      the plan body paragraph so it's visible before scrolling past the phase list
- [x] Compact clarification prompt
      The prompt in buildClarifyPrompt is too verbose; shrink it to only provide the
      taxonomy and output format, making instructions more general and concise
- [x] Rename Clarify button to "Copy Clarifications Prompt"
      The button currently reads "Clarify before starting", which is unclear — rename
      to "Copy Clarifications Prompt" so its purpose is obvious at a glance

### Log
- 2026-06-27: Clarify before starting button should be moved above the plan description (not in the table header). And also the promt is huge we should compact the prompt and make the instructures for clarifications more general. In prompt we can only provide where to look for clarification instructuins
- 2026-06-27: Audit appended two missing phases: button placement fix (move above plan description body) and prompt compaction (shrink to taxonomy+format only)
- 2026-06-27: We should have a clear button name - currently it is not understandable what is this button about. I think it is better to rename it to - Copy Clarifications Prompt
- 2026-06-27: icon and text are not on the same row in this Clarification button
- 2026-06-27: If you in audit check latest 2 logs about button, and add phases to fix it!!! And remove this log if you got it!
- 2026-06-27: Audit appended missing rename phase (button label still says "Clarify before starting" per log #3); icon/text layout per log #4 is already correct
- 2026-06-27: but what about icon position? I dont see phase to fix icon position in this button

## GitHub CI/CD automation

**Status:** review
**Kind:** feat
**Id:** FEAT-22
**Idea:** IDEA-18
**Created:** 2026-06-27
**Updated:** 2026-06-28
**Tags:** ci, cd, github

This repo has zero `.github/` workflows today — no CI runs tsc/biome/vitest
on push or PR, no automated npm publish, and every commit goes straight to
`main`. One piece of groundwork already exists unused: `.commitlintrc.json`
enforces Conventional Commits but nothing runs it. Wires up real CI/CD around
what's already there: CI on push/PR, automated versioning via release-please
(with an explicit decision on whether `refactor` bumps patch), npm publish
on release, and a PR-per-feature workflow tied to this repo's own
FEAT-N/FIX-N naming scheme.

### Phases
- [x] Add CI workflow for tests, quality, and commitlint
      A `.github/workflows/ci.yml` running `pnpm install`, then
      `pnpm run check-types`/`pnpm run lint`/`pnpm test` on push and PR,
      plus `commitlint --from <base> --to <head>` against the PR's commits
      to finally give `.commitlintrc.json` a real job.
- [x] Configure release-please for automated versioning
      Decision: `refactor` bumps patch — this repo treats refactoring as a
      first-class deliverable (4 REFACTOR plans). Since release-please
      doesn't support custom type-to-bump mappings natively, `refactor`
      appears in `changelog-sections` under "Code Refactoring" and rides
      along with the next feat/fix release. To make refactor trigger
      independent patch releases, toggle `versioning` to `always-bump-patch`
      or add a custom release-please versioning plugin.
- [x] Add npm publish workflow
      Triggered on the GitHub Release created by release-please: runs
      `pnpm run build` and `npm publish` using an `NPM_TOKEN` repo secret.
- [x] Adopt per-feature branch workflow
      Define a branch-naming convention (e.g. `feat/feat-N-title`), a PR
      creation mechanism, and decide when a PR opens and whether `main`
      stays directly pushable. Resolve the open question about how
      per-branch work affects IDEA-4's agent writing directly to
      `plans.md`/`progress.md`.
- [x] Split CI into named jobs: Quality, Tests and Consistency
      Split `ci.yml`'s single `ci` job into three parallel jobs
      (`quality`: `check-types` + `lint`, `tests`: `vitest`,
      `consistency`: `commitlint`) so each appears as its own
      named check on PRs per the log entry.
- [x] Make refactor commits trigger independent patch releases
      The decision in phase 2 says `refactor` bumps patch. After
      verifying: release-please's `DefaultVersioningStrategy` already
      maps `refactor` → patch under `"versioning": "default"` — its
      `determineReleaseType` fallback returns `PatchVersionUpdate` for
      every non-breaking, non-feat commit type. The changelog section
      was already configured; only the understanding needed updating.
- [x] Add explicit job/step names and lock down `main`
      Audit found job ids (`quality`/`tests`/`consistency`) had no `name:`
      field, so GitHub showed the lowercase id rather than the intended
      "Quality"/"Tests"/"Consistency" labels; same gap on every step across
      all 4 workflows (no `name:`, just bare `run:`/`uses:`). Added explicit
      `name:` to every job and step. Live-repo audit via `gh api` also found
      `main` had zero branch protection (a broken commit could merge via PR
      with no required checks) and no `NPM_TOKEN` secret (publish.yml would
      fail on first release). Branch protection added requiring
      Quality/Tests/Consistency to pass before merge, without blocking direct
      pushes (`enforce_admins`/restrictions off) per the existing "main stays
      pushable" decision. `NPM_TOKEN` left for the user to set directly
      (secret value, not something an agent should generate or see).
- [x] Adopt `type(scope): description` commit convention
      Scope is the plan/idea number with no kind prefix (e.g. `feat(22): ...`
      for `FEAT-22`); non-plan commits use a short area name instead (e.g.
      `chore(deps): ...`). Added `scope-empty: [2, "never"]` to
      `.commitlintrc.json` to require a scope on every commit. While testing
      against this repo's real commit history, found that `subject-case`
      (inherited from `@commitlint/config-conventional`) rejects the
      capitalized subjects this repo has always used (e.g. "Settings config
      workspace") — the `consistency` CI check would have failed on every
      existing-style commit the first time it ran on a real PR. Disabled
      `subject-case` (`[2, "never", []]`) to match the established style
      instead of forcing a lowercase-first-word rewrite. Documented the full
      convention in `AGENTS.md`.
- [x] Rename release-please and create-pr workflows for clarity
      `release-please.yml`/job `release-please` tied the file name to the
      underlying tool rather than what it does — renamed to `release.yml`/job
      `release` (workflow display name "Release"). `create-pr.yml`/job
      `create-pr` was too generic (sounds like it handles any PR creation,
      not specifically the auto-draft-on-first-push behavior) — renamed to
      `draft-pr.yml`/job `draft-pr` (display name "Draft PR"). Did not merge
      the two workflows: they trigger on disjoint events (`release.yml` only
      on push to `main`; `draft-pr.yml` only on push to feature branches) and
      serve unrelated concerns, so one file per concern stays clearer.
      `.github/release-please-config.json` and
      `.github/.release-please-manifest.json` keep their tool-specific names
      — those are release-please's own expected config files, recognizable
      to anyone who knows the tool; only the workflow/job display names
      (which show up as GitHub UI labels) needed to be generic. Updated
      references in `AGENTS.md` and `decisions.md`.
- [x] Auto-create branch when a plan's first phase starts
      `agent.start(plan, phaseIndex)` in `src/app/server/agent.ts` is the
      single entry point the Stack panel's Play button calls. The trigger is
      the **first phase actually being launched** (`phaseIndex === 0`), not
      the plan's `Status` flipping to `in-progress` — a plan can sit
      `in-progress` with zero phases started and zero branch yet. When phase
      0 launches, derive the branch name from the existing
      `<kind>/<lowercase-id>-<kebab-title>` convention and create+check it
      out off `main` before spawning the agent (extend `createGitManager()`
      in `src/app/server/git.ts` with an `ensureBranch(plan)` alongside its
      existing `commit()`). No-op if already on that branch. Only covers
      phase starts launched through the agent UI — direct edits outside that
      flow still need a manual branch.
- [x] Block switching to another plan while a branch is in flight
      Once a plan has a branch (created by the phase above), the working
      tree is checked out to that branch — starting agent work on a
      *different* plan would mean switching branches mid-flight with
      uncommitted/unmerged work sitting on the first. Block launching agent
      work on any other plan while the current plan's branch exists and the
      plan hasn't reached `done`. Show the user a message naming the
      in-flight plan and telling them to finish it first (e.g. "Finish
      `FEAT-22` — GitHub CI/CD automation — before starting another plan").
      This is stricter than the existing one-task-at-a-time guard in
      `agent.ts`: that only blocks concurrent *agent processes*; this blocks
      switching plans even between agent runs, for as long as the branch is
      unfinished.
- [x] Auto-create branch and finalize commit on plan approval
      On the "Approve & close" action (the one that flips a plan's `Status`
      to `done`), check whether the plan currently has an associated branch.
      If none exists (e.g. work happened straight on `main`), create one at
      that point via the same `ensureBranch(plan)`. Commit any outstanding
      changes with a `type(scope): description` message (per the convention
      from phase 8) whose body lists every phase's title as a bullet, so the
      commit doubles as a changelog of what shipped for that plan. This is
      also the point that lifts the "block switching plans" restriction from
      the phase above, since the plan is now `done`.
- [x] Show branch name in the commit card
      The commit section at the top of the Stack panel's card
      (`src/app/components/stack-panel.tsx:689`) shows staged files and a
      commit title/message form, but never says which branch the commit
      will land on. `git.ts` already has `getCurrentBranch()` (line 142) but
      it isn't exposed via `/api/git/status` — add it to that response and
      render it (e.g. a small label/Stamp next to the "Commit" heading) so
      it's obvious at a glance which plan's branch is checked out before
      committing.
- [x] Fix approval-time branch guard and empty-scope commit
      Review found two bugs in the approval flow (`PATCH /api/plans`,
      `status: 'done'`, `src/app/server/api.ts`). (1) It called
      `git.ensureBranch()`/`git.commitAll()` without first checking
      `checkBranchConflictForPlan()` — the guard phase 11 added — so
      approving plan B while plan A's branch had uncommitted work would
      checkout/create plan B's branch carrying plan A's dirty changes along,
      then commit them under plan B's message. Added the same conflict check
      before the write, returning 409 if another plan's branch is still in
      flight. (2) `finalEntry.id?.replace(...) ?? ''` produced an empty
      commit scope (`chore(): Title`) for plans with no `Id`, violating the
      `scope-empty` rule from phase 8. Added a kebab-title fallback scope for
      that case.
- [x] Drop auto-commit on approval — branch-only
      Decided approval should only ensure the branch exists (create it if
      none, no-op if already on it); committing is left to the user via the
      Stack panel's existing manual commit flow. Removed `git.commitAll()`
      from `git.ts` (now unused) and the commit-title/body/scope generation
      from the `PATCH /api/plans` `status: 'done'` handler in `api.ts` —
      `ensureBranch()` plus the existing `checkBranchConflictForPlan()` guard
      from phase 14 are all that's left on approval. The
      `type(scope): description` convention from phase 8 still applies, just
      typed by hand rather than generated.
- [x] Fix CI failing on unpinned pnpm version
      Live pipeline failed: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` from
      pnpm itself, then `this version of pnpm requires at least Node.js
      v22.13`. Root cause: every workflow's `pnpm/action-setup@v4` used
      `version: latest`, which resolved to pnpm 11.9 (needs Node ≥22.13's
      `node:sqlite`), while every workflow's `actions/setup-node@v4` pins
      `node-version: 20`. Locally `pnpm --version` is 10.12.1, fine on Node
      20 — only CI had drifted. Fixed by adding `"packageManager":
      "pnpm@10.12.1"` to `package.json` as the single source of truth, and
      removing the `version: latest` override from all 4 `pnpm/action-setup`
      steps (`ci.yml` ×3, `publish.yml` ×1) so the action reads the pinned
      version from `packageManager` instead.
- [x] Fix CI failing on unresolvable @dendelion/paper-ui module
      Quality check (`tsc --noEmit`) failed with `Cannot find module
      '@dendelion/paper-ui'` across every file importing it. Root cause:
      `package.json` declared `"@dendelion/paper-ui": "link:../paper-ui"` — a
      relative symlink to a sibling repo that only exists on the dev
      machine. CI has no `../paper-ui` checked out, and critically, this
      would have broken any real `npm install paper-camp` too (the planned
      `publish.yml` would have shipped a broken package). Fix, in order:
      (1) in `~/dev/paper-ui`, committed 30+ files of pending work (5 new
      components — Accordion, Icon, ListItem, Progress, Textarea — plus
      supporting changes), wrote an accurate `minor` changeset (the existing
      one was stale, marked `patch`), ran `pnpm run version` to bump
      `0.1.1` → `0.2.0`, verified `check-types`/`build`, and `pnpm publish
      --access public`. (2) In `paper-camp`, changed the dependency to
      `"^0.2.0"` (a normal registry range) and ran `pnpm install` — verified
      it resolves a real package from the npm store, not the old symlink.
      `tsc`/`biome`/`vitest` all clean. (3) Documented the new workflow in
      `AGENTS.md`: `pnpm link ../paper-ui` for local active co-development
      (invisible to git/CI), plain `pnpm install` to go back to the
      registry version, and the changeset → version → publish sequence for
      shipping a new paper-ui release.
- [x] Fix duplicate CI runs on feature branches
      `ci.yml` triggered on both `push` (to `main`/`feat/*`/`fix/*`/etc.,
      added in phase 4) and `pull_request` (to `main`). Once `draft-pr.yml`
      opens a PR on the first push, every later push to that branch fires
      both events for the same commit — two full sets of Quality/Tests/
      Consistency runs. Restricted `push` to `main` only; `pull_request`
      alone now covers every feature-branch commit, since a PR exists from
      the first push onward (created within seconds by `draft-pr.yml`), so
      there's no coverage gap.
- [x] Fix dev server breaking after the paper-ui registry switch
      User reported the app wouldn't load: `SyntaxError: The requested
      module .../react-dom/index.js does not provide an export named
      'createPortal'`. Root cause: `vite.app.config.ts` had
      `optimizeDeps: { exclude: ['@dendelion/paper-ui'] }`, set up for the
      old `link:../paper-ui` symlink workflow so Vite always read the live
      symlinked `dist/` fresh. With `@dendelion/paper-ui` now a normal
      registry-installed package, that exclude meant Vite never crawled into
      it to discover its `react-dom` import, so `react-dom`'s CJS module got
      served without ESM interop — hence the missing named export. Removed
      the `optimizeDeps.exclude` entry; restarted the dev server with a
      cleared `node_modules/.vite` cache. Verified live in the browser via
      Claude in Chrome: Plans and Settings pages render fully, zero console
      errors, branch-name `Stamp` in the Stack panel still shows correctly.
- [x] Add CodeRabbit for automated PR review
      Install the CodeRabbit GitHub App on this repo (free for public repos,
      no API key/secret needed — separate from the Claude-based local
      `/code-review` skill, giving every PR a second, independent pass).
      Add a `.coderabbit.yaml` pointing it at this repo's actual conventions
      (`AGENTS.md`, `CODE_STYLE.md`, `UX_PRINCIPLES.md`) so review comments
      check against real repo rules instead of generic defaults. Goal is a
      lightweight "does this fit the repo's style/rules" pass, not deep bug
      hunting — CodeRabbit was picked over Greptile (pricier, noisier,
      overkill for a solo project) and Qodo Merge (more configurable but
      requires self-hosting the Action and managing your own LLM key).
- [x] Open draft PRs as a named GitHub App bot, not `github-actions[bot]`
      `draft-pr.yml` ran `gh pr create` with `secrets.GITHUB_TOKEN`, so every
      auto-created draft PR showed up authored by `github-actions[bot]`. User
      created a GitHub App named **Scout** (`pull_requests: read/write`, no
      webhook) under the `adooone` org and installed it on this repo, then
      set `SCOUT_APP_ID`/`SCOUT_PRIVATE_KEY` as repo secrets themselves (`gh
      secret set`) so the private key never touched this chat. Along the
      way: `gh secret set` echoed back `croco-dendy/paper-camp` instead of
      `adooone/paper-camp` — turned out to be the same repo (same numeric
      id), a leftover redirect from when the repo was transferred from the
      personal account into the org; the secret landed correctly either way,
      but updated the local `origin` remote to the canonical
      `adooone/paper-camp` URL to stop the confusion going forward. Added a
      `Generate Scout app token` step to `draft-pr.yml` using
      `actions/create-github-app-token@v1` with those two secrets, and
      pointed the `Create draft PR` step's `GITHUB_TOKEN` env at
      `steps.app-token.outputs.token` instead of `secrets.GITHUB_TOKEN`.
      YAML re-parses clean, `biome` clean.
- [x] Triage and fix CodeRabbit's first review pass
      CodeRabbit posted 9 actionable comments on PR #1. Fixed the
      clear-cut ones: (1) `draft-pr.yml` interpolated `github.ref_name`
      directly into the shell script (`BRANCH="${{ github.ref_name }}"`) — a
      real GitHub Actions injection risk; moved it into `env: BRANCH:` and
      read `$BRANCH` at runtime instead. (2) Added `persist-credentials:
      false` to all 4 checkout steps across `ci.yml`/`draft-pr.yml` so the
      token isn't left in git config during later `pnpm install` script
      execution. (3) `git.ts`'s `ensureBranch()` silently continued past a
      failed `checkout -b`/fallback `checkout`, assuming any `-b` failure
      meant "branch already exists" — now throws with the real git stderr
      if either checkout actually fails, instead of proceeding on the wrong
      branch. (4) `git-api.ts`'s `fetchGitStatus()` didn't check
      `response.ok` before parsing, so a `{ error: ... }` failure response
      would overwrite the store with `undefined`s — now throws on non-OK,
      matching the pattern `commitChanges` already used in the same file.
      (5) `decisions.md`'s "Per-feature branch workflow" rationale said
      branch protection "isn't configured," contradicting the later
      decision that added it — reworded to say it gates merges, not pushes.
      (6) Merged a duplicate `## 2026-06-27` heading in `progress.md` into
      the section above it. Also caught and fixed the plan-level issue
      CodeRabbit flagged: this plan's `Status` was `done` instead of
      `review`, violating `AGENTS.md`'s own rule that only an explicit
      "Approve & close" sets `done` — reverted to `review`. Skipped
      CodeRabbit's suggestion to call `ensureBranch()` on every phase launch
      (not just `phaseIndex === 0`) — that contradicts this plan's own
      earlier scoping decision and needs a real discussion, not a drive-by
      fix. `tsc`/`biome`/`vitest` all clean (35 tests), all 4 workflow YAMLs
      re-parse clean.
- [x] Call `ensureBranch()` on every phase, not just phase 0
      Reopened the disagreement flagged in the phase above: after weighing
      it, decided CodeRabbit's edge case is real (a plan resumed mid-flight
      after someone manually switched branches would silently run on the
      wrong one) and the fix is free — `ensureBranch()` is already
      idempotent, a no-op when already on the right branch. Changed
      `agent.ts`'s `start()` from `if (phaseIndex === 0) { ensureBranch(plan)
      }` to an unconditional `ensureBranch(plan)` call before every phase
      launch. Supersedes the original "first phase only" scoping decision.
      `tsc`/`biome`/`vitest` all clean (35 tests).
- [x] Scope the npm package as `@dendelion/paper-camp`
      Confirmed `@dendelion` is a scope the user already has `read-write`
      access to (same one `@dendelion/paper-ui` publishes under), and
      `@dendelion/paper-camp` is unclaimed. Renamed `package.json`'s `name`
      to `@dendelion/paper-camp` — the `bin` field stays `{ "paper-camp":
      "./dist/cli/index.js" }` unchanged, so the installed CLI command name
      doesn't change even though the package identity does. Updated
      `.github/release-please-config.json`'s `package-name` to match.
      Scoped packages default to private on npm, so added `--access public`
      to `publish.yml`'s `npm publish` call — without it the first publish
      would have silently tried to create a private package and failed (or
      succeeded as private, which isn't what's wanted for an open-source
      CLI). Also added `persist-credentials: false` to `publish.yml`'s
      checkout for consistency with the hardening applied to the other
      workflows in phase 22. `tsc`/`biome`/`vitest`/`build` all clean (35
      tests), `pnpm-lock.yaml` doesn't need updating (it doesn't store the
      root package's own name).

### Log
- 2026-06-27: I want to have 3 steps in PR visible for each check - Quality, Tests and Consistency
- 2026-06-27: Phase 4 — Adopted per-feature branch workflow: documented branch-naming convention in AGENTS.md (`<kind>/<lowercase-id>-<kebab-title>`), added `.github/workflows/create-pr.yml` (auto-creates a draft PR on first push to any `feat/*`/`fix/*`/`refactor/*`/`chore/*`/`docs/*` branch, idempotent), updated `ci.yml` to also trigger on pushes to feature branches (not just `main`+PRs), and resolved the IDEA-4 impact question (agents write to whichever branch is checked out — no behavioral change needed, merge conflicts from two branches touching `plans.md` accepted until IDEA-20). `main` stays pushable for agent progress writes, tiny fixes, and config changes. All decisions recorded in `decisions.md`.
- 2026-06-27: Audit found two missing phases: (1) `ci.yml` has one job → PRs show one check, not three; split into Quality/Tests/Consistency jobs per log entry. (2) `release-please-config.json` still on `"default"` versioning so `refactor` doesn't trigger releases despite the phase-2 decision.
- 2026-06-27: Asked whether branch creation can be automated for "start a plan's first phase" since this is our own app, not a third party — we can wire it directly into the agent-launch code path. Also want a check on plan approval: if the plan has no branch yet, create one then, and commit with a proper `type(scope)` name whose body lists all the phase titles. Appended two phases for this (not implementing yet, just scoping them).
- 2026-06-27: Clarified the trigger is the first phase actually starting, not the plan merely reaching `in-progress` status with nothing started. Also want plan-switching blocked once a branch exists for an unfinished plan — show the user a message to finish the current feature first. Appended a phase for the block; not implementing yet.
- 2026-06-27: Also want the branch name shown in the commit section at the top of the Stack panel's card, so it's obvious which branch a commit is about to land on. Appended a phase for it.
- 2026-06-27: After seeing approval auto-commit in action, decided against it — only auto-create the branch (if missing); commit manually instead. Also asked whether the `feat/feat-22-...` double-prefix branch name is OK; confirmed it's the deliberate tradeoff from the original branch-naming decision (redundant but keeps the plan ID visually obvious in a plain `git branch` listing).
- 2026-06-27: Reported a real CI failure: `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` then "this version of pnpm requires at least Node.js v22.13". Root cause was `pnpm/action-setup@v4`'s unpinned `version: latest` resolving to pnpm 11 against workflows pinned to Node 20. Pinned pnpm via `package.json`'s `packageManager` field instead.
- 2026-06-27: Reported a second CI failure right after — `Cannot find module '@dendelion/paper-ui'` cascading across every file. Root cause was the `link:../paper-ui` dependency, which only resolves on the dev machine. Confirmed the deeper problem (this would break a real `npm install` too, since the package is already published to npm), and chose to publish the pending paper-ui work as `0.2.0` and switch paper-camp to depend on the registry version, with `pnpm link` documented for local co-development.
- 2026-06-27: Noticed duplicated CI jobs — once for `push`, once for `pull_request` — on the same feature-branch commit. Root cause was `ci.yml` triggering on both events for feature branches; fixed by dropping the feature-branch `push` trigger now that `draft-pr.yml` guarantees a PR exists from the first push onward.
- 2026-06-27: Asked about adding automated PR review beyond the local Claude-based `/code-review` skill, specifically a tool different from Claude to double-check code style/rule fit. Compared CodeRabbit, Greptile, Qodo Merge, Sourcery; picked CodeRabbit (free for public repos, lowest setup friction, low false-positive rate) over Greptile (pricier/noisier) and Qodo Merge (more configurable but self-hosted). Appended a phase; not implementing yet.
- 2026-06-27: Noticed draft PRs are authored by `github-actions[bot]` and wants a custom-named bot identity instead. Discussed GitHub App vs. dedicated bot account; went with a GitHub App. Named it **Scout** after rejecting "Ranger" and a few other camp-themed options (Sherpa, Lookout, Quartermaster, Trailblazer, Camp Scribe). User is creating the App now; appended a phase to wire it into `draft-pr.yml` once the App ID/private key are available.
- 2026-06-28: Asked to check CodeRabbit's review comments on the live PR and think through how PR review fits the plan-status methodology. Triaged 9 comments; fixed the clear-cut ones (injection risk, error-swallowing in `ensureBranch`, unchecked response in `fetchGitStatus`, persist-credentials hardening, a self-contradicting `decisions.md` paragraph, a duplicate `progress.md` heading), and separately fixed the `Status: done` → `review` mismatch CodeRabbit also caught. Recommendation: treat CodeRabbit's findings as a pre-approval checklist, not a `review`-status gate — `review` still just means "phases done," and skimming/triaging bot comments happens before clicking Approve & close, not before.
- 2026-06-28: Reopened the one disagreement with CodeRabbit — decided a "quick check we're on the right branch" before every phase is worth it, not just at phase 0. Reversed the earlier "first phase only" decision; appended a phase.
- 2026-06-28: Decided the npm package should be scoped, not bare `paper-camp`. Confirmed `@dendelion` (the scope `paper-ui` already publishes under) is available and accessible; scoped it as `@dendelion/paper-camp`.
