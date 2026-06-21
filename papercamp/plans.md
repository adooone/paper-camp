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
