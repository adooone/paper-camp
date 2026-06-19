# Paper Camp — Technical Reference

The philosophy and intent live in [ideas.md](./ideas.md). This document covers the concrete shape of the system: folders, files, commands, and stack.

---

## Two directories, two jobs

### `papercamp/` — the project's memory (versioned, human + AI readable)

Lives at the repo root. Plain markdown, committed alongside the code it describes.

| File | Purpose |
|------|---------|
| `ideas.md` | Philosophy, intent, raw thoughts — the "why" behind the project. |
| `plans.md` | What's being built, broken into actionable steps. |
| `progress.md` | Running log of what's done, in chronological order. |
| `decisions.md` | Choices made and the reasoning behind them — the record that prevents re-litigating settled questions. |
| `open-questions.md` | Unresolved items that need a decision before work can proceed. |

No numbering scheme, no status-icon tables, no separate index file — the folder itself is the index. A file is either current or it isn't; history is git's job, not a "Status: PENDING/IN_PROGRESS/COMPLETED" field inside the document.

---

## Storage decision: markdown, not a database

**Decision:** the `papercamp/` files are the single source of truth. No SQLite, no JSON store, no sync layer. The dashboard parses the markdown live, on every read.

**Why not a database:** the core promise is that any AI assistant — Claude Code, Cursor, whatever's open in the terminal — can read and edit project memory with zero setup, using its normal file tools. A database forces a custom MCP server or query tool into every AI session just to touch the data, and it kills meaningful git diffs (binary/opaque blobs vs. readable history). Markdown is the only format that's human-readable, AI-readable-with-no-tooling, and git-diffable at once — that's non-negotiable given the project's philosophy.

**Why not a cache either:** for a solo project's planning files (a handful of small `.md` files), parsing on every dashboard request is fast enough that an index/cache buys nothing but complexity. If that ever stops being true at scale, the fix is a disposable, gitignored index rebuilt from the files on change — never a second source of truth. Not needed for v1.

**How structure is added without losing the prose:** real top-of-file YAML frontmatter doesn't fit `plans.md`, `decisions.md`, or `open-questions.md`, because each file holds *multiple* independent records, not one. Instead, every record uses the same shape:

```markdown
## <Title>

**Field:** value
**Field:** value

Free-form prose body.
```

The parser reads a `## Heading`, then collects consecutive `**Key:** value` lines immediately below it (stops at the first blank line or non-matching line), and treats everything after as the record's markdown body. One parser function handles all three files; only the expected field set differs per file. Fields are validated per-file with a schema (e.g. zod) — unknown or missing required fields surface as a dashboard warning, never a hard crash, since a human or AI can always hand-edit the file into an invalid shape.

Dates are always `YYYY-MM-DD`.

### `ideas.md` — no schema

Pure prose, no fields, never parsed into structured records. The dashboard renders it read-only (e.g. an "About this project" panel). This file is for thinking, not tracking.

### `plans.md`

One `## Heading` per plan. Titles start with a verb and are capitalised (e.g. `## Build dashboard app`, `## Refresh about.md`).

| Field | Required | Values |
|-------|----------|--------|
| `Status` | yes | `idea \| planned \| in-progress \| done \| dropped` |
| `Created` | yes | date |
| `Updated` | no | date |
| `Tags` | no | comma-separated |

Body: free prose description. Optional `### Phases` subsection with a standard markdown checkbox list (`- [ ]` / `- [x]`) — this drives the plan's progress percentage and feeds the dashboard's health/momentum gauges.

```markdown
## Build markdown storage layer

**Status:** in-progress
**Created:** 2026-06-18
**Tags:** core, parser

Use frontmatter-style fields per entry instead of a database...

### Phases
- [x] Decide on storage format
- [ ] Write zod schemas
- [ ] Build parser
```

### `progress.md` — append-only log, not record-based

No per-entry fields. Structured by date instead:

```markdown
## 2026-06-18
- Decided on markdown + per-entry fields over a database (see decisions.md)
- Drafted schemas for plans/decisions/open-questions
```

`## YYYY-MM-DD` headings, bullet list underneath. Entries are never edited after the fact — append a new dated section instead. Immutable history, same principle as a changelog.

### `decisions.md`

One `## Heading` per decision (an ADR, lightweight).

| Field | Required | Values |
|-------|----------|--------|
| `Date` | yes | date |
| `Status` | yes | `decided \| superseded` |
| `Superseded-by` | only if `Status: superseded` | link/title of the replacing decision |

Body is free prose, conventionally using bold lead-ins for **Context**, **Decision**, **Rationale**, and optionally **Alternatives** — but these are prose markers for humans/AI to read, not parsed fields. Only `Date` and `Status` are structured.

### `open-questions.md`

One `## Heading` per question.

| Field | Required | Values |
|-------|----------|--------|
| `Status` | yes | `open \| resolved` |
| `Raised` | yes | date |
| `Resolved-by` | only if `Status: resolved` | link/title of the decisions.md entry that answered it |

Body: free prose framing the question and why it matters. Once answered, write the answer as a new entry in `decisions.md`, set `Resolved-by` here, flip `Status` to `resolved` — don't delete the question, it's part of the honest record.

### `.paper-camp/` — local config (not the memory)

Holds machine state, not project narrative.

```json
{
  "version": "0.1.0",
  "projectName": "paper-camp",
  "initializedAt": "2026-04-29T00:00:00.000Z"
}
```

---

## CLI

Bin entry: `paper-camp` → `dist/cli/index.js`, built with `commander`. Implemented in `src/cli/index.ts`.

| Command | Effect |
|---------|--------|
| `paper-camp init [project-name] [-i, --intent <text>]` | Creates `.paper-camp/config.json` and `papercamp/{ideas,plans,progress,decisions,open-questions}.md`. `--intent` seeds `ideas.md` with the one-line description; everything else starts empty for the AI/human to fill in during the first session — the CLI does not call an LLM itself (see "Storage decision" below for why init stays this thin). Refuses to run if `.paper-camp/config.json` already exists, and never overwrites an existing `ideas.md`. |
| `paper-camp dev [-p, --port <number>]` | Starts a plain `node:http` server (`src/cli/dev-server.ts`): `/api/*` via `createApiMiddleware`, everything else served statically from the built `dist/app`, falling back to `index.html` for unknown paths (SPA routing). Defaults to port 3333. |
| `paper-camp add plan <name>` | Appends a new `## <name>` entry to `papercamp/plans.md` with `Status: idea` and today's date, using the plan schema below. |

---

## Package layout

Source tree under `src/`:

- `src/types/index.ts` — shared types (`PlanEntry`, `DecisionEntry`, `OpenQuestionEntry`, `ProgressEntry`, `PhaseItem`, `PaperCampConfig`).
- `src/core/schemas.ts` — zod schemas validating the per-entry fields block for each file (see schemas below).
- `src/core/parser.ts` — `parseRawEntries` (generic `## heading` + fields + body + `### Phases` splitter), typed `parsePlans`/`parseDecisions`/`parseOpenQuestions` (validate with zod, collect warnings instead of throwing), and `parseProgress` (date-log parser, no fields).
- `src/core/serializer.ts` — `formatPlanEntry`/`formatDecisionEntry`/`formatOpenQuestionEntry`/`formatProgressEntry` plus `appendBlock`, used to write new entries back to a file without disturbing existing content.
- `src/core/scaffold.ts` — `initProject`, used by `init`.
- `src/core/index.ts` — public core API, re-exports all of the above.
- `src/cli/index.ts` — the commander CLI.
- `src/cli/dev-server.ts` — `startDevServer({ root, port })`, the plain `node:http` server `paper-camp dev` runs: reuses `createApiMiddleware` for `/api/*`, serves the built `dist/app` statically otherwise, with an `index.html` SPA fallback.
- `src/app/server/api.ts` — `createApiMiddleware(root)`, a Connect-compatible `(req, res, next)` handler, parsed live from `root`'s `papercamp/`/`.paper-camp/`. Shared by both the Vite dev plugin (`pnpm dev`) and `dev-server.ts` (`paper-camp dev`). Routes:
  - `GET /api/plans`, `/api/progress`, `/api/decisions`, `/api/open-questions`, `/api/ideas` (raw `{ content }`), `/api/config`, `/api/package-name` (reads `root`'s own `package.json`, used for nav/sidebar branding).
  - `POST /api/plans` — append a new plan entry (`{ title, content? }`), used by the "Add idea" modal; always written with `Status: idea`.
  - `PATCH /api/plans?title=...` — update an existing entry's `phases` and/or `status`, stamping `Updated` with today's date. Setting `status: in-progress` also auto-demotes any other currently-`in-progress` entry to `planned` in the same write, so only one plan is ever "in focus" at a time.
  - `DELETE /api/plans?title=...` — remove an entry by title.
  - `GET /api/icon` — serves whichever `.paper-camp/assets/icon.{svg,png,jpg,jpeg,gif,webp}` exists, 404 if none.
  - `POST /api/icon` — accepts `{ dataUri }` (a `data:image/...;base64,...` URI), writes it to `.paper-camp/assets/icon.<ext>`.
- `src/app/router.tsx` — code-based TanStack Router tree: one root route rendering paper-ui's `Layout` (header and sidebar both off; a bottom-floating `NavigationIsland` for nav, showing the project icon/name fetched from `/api/icon` and `/api/package-name`) + `Outlet`, three child routes for the pages below. `PlansSidebar` is rendered alongside the outlet only on `/`.
- `src/app/features/{plans,focus,settings}/` — the page components.
- `src/app/stores/app-store.ts` — a `zustand` store (`useAppStore`) holding `plans` (loaded via `/api/plans`), `ideaEntries` (parsed client-side from `/api/ideas`' raw content, split on `---` separators), the active plan/idea selection, and the Plans page's `view: 'list' | 'board'` toggle. Loaded once from `router.tsx`'s root route on mount.
- `src/app/main.tsx` — mounts `RouterProvider` into `#root`, imports `@dendelion/paper-ui/dist/index.css`.
- `src/app/components/page-title.tsx` — a real big page-title heading. paper-ui's compiled CSS resets `h1`–`h6` to `font-size: inherit; font-weight: inherit` (Tailwind preflight), so a plain `<h1>` renders at body-text size — this is the deliberate override (Luminari, 2.5rem, 600 weight), shared by both pages.
- `src/app/components/add-idea-modal.tsx` — a paper-ui `Modal` with title/description fields, used from the Plans sidebar's "Ideas" section "+" button. Submits via `POST /api/plans`.

Build outputs:

- `./` → `dist/core/index.js` — the core library (`vite.config.ts`, lib mode).
- `./` (bin) → `dist/cli/index.js` — the CLI, a third lib entry alongside `core`/`types` (added because the `package.json` `bin` field originally pointed nowhere — `vite.config.ts` only built `core`/`types`). The lib build's `rollupOptions.external` is a function matching any `node:*` import plus a short list of bare specifiers (`react`, `commander`, `zod`, etc.) — needed because `dev-server.ts` pulls in `node:http`/`node:url`, and a hardcoded string list silently missed those the first time.
- `./app` → `dist/app/index.html` + `assets/` — the dashboard SPA, built separately by `vite.app.config.ts` (`pnpm build:app`, also run as part of `pnpm build`). Pure static output, not a JS module — there is no `package.json` export for it; `paper-camp dev`'s static file server is the only consumer.

Path aliases (`vite.config.ts`, `vite.app.config.ts`, `tsconfig.json`): `@core`, `@cli`, `@app`, `@types` under `src/`. Source files themselves use relative imports (`./parser.js`, `../types/index.js`) rather than the aliases, so the same code runs unchanged under `bun src/cli/index.ts` (the `cli` dev script) and the built `dist/cli/index.js`.

**`public/fonts/Luminari-Regular.woff`** is a vendored copy of `@dendelion/paper-ui`'s display font. Their compiled CSS references it via an absolute `url(/fonts/Luminari-Regular.woff)`, so any consuming app has to place that file at its own web root — paper-ui doesn't do this for you. Without it, the build silently falls back to the next font in the stack (Cormorant Garamond → Georgia → serif); the other fonts paper-ui's README mentions (Cormorant Garamond, Caveat, JetBrains Mono) aren't actually self-hosted via `@font-face` in the shipped CSS, just referenced by name, so no extra vendoring was needed for those.

**`src/app/styles/utilities.css`** carries `btn-green`/`btn-orange`/`btn-red`/`btn-blue`/`btn-violet` classes that recolor `Button`'s fill to soft pastel washes with dark text, applied to the Open/Start/Stop/Mark-complete buttons. paper-ui's `Button` has no color prop — its fill is an SVG `<path>` layered behind the label, not a CSS `background` — so these classes target that path directly with `!important` (needed since paper-ui's own hover/active rules outrank a single external class in specificity). Note: paper-ui's own "blue" and "green" watercolor tokens are literally the same hex value upstream, so these five colors are custom hex values, not a reuse of paper-ui's tokens.

Stack:
- **UI**: `@dendelion/paper-ui` (paper/ink/canvas/watercolor design system — textures, warm color tokens, hand-drawn interaction details). The full source lives at `~/dev/paper-ui` (sibling repo), with a component showcase at `src/showcase/pages/components.tsx`. The dashboard currently uses: `Layout` (header/sidebar/automatic Page-wrap all off), `NavigationIsland` (bottom-floating nav), `Page` (speckle texture wrapping the content outlet), `Card`, `Stamp`, `Alert`, `Checkbox`, `Button`, `IconButton`, `Input`, `Textarea`, `Modal`, `Progress`, `ListItem`.
- **Routing**: `@tanstack/react-router`
- **State**: `zustand`
- **Validation**: `zod` — validates the parsed fields block per entry, kept external in the build (like `commander`/`zustand`) rather than bundled.
- **Build/tooling**: Vite (lib build via `vite-plugin-dts` for `core`/`types`, app build via `@vitejs/plugin-react-swc`), TypeScript (strict), Biome (lint/format), Vitest.

---

## Dashboard

Two ways to run it, both serving the same app and the same `/api/*` shape against whatever directory you run them in:

- **`pnpm dev`** (this repo only) — Vite's dev server (`vite.app.config.ts`), with a `configureServer` plugin mounting `createApiMiddleware(process.cwd())`. Used while developing `src/app` itself, with HMR.
- **`paper-camp dev`** (installed package) — `src/cli/dev-server.ts`'s plain `node:http` server, serving the *built* `dist/app` plus the same API middleware. This is what an end user actually runs.

Three pages exist:

- **Plans** (`/`) — fetches `/api/plans`. Has two views, toggled by `ViewToggle` (state lives in `useAppStore`):
  - **List view** (default) — sections by status: "In progress", "Backlog" (`planned` + `idea`), an "Ideas" grid of `ideaEntries` (see below), and a collapsed-by-default "Closed" section (`done` + `dropped`). Each plan renders as a `PlanCard` — `Card` with a `Stamp` for status (rgba wash + matching dark text), dates/tags, body, a `ProgressBar` computed from `### Phases` checkboxes, an "Open" button, and a Start/Stop button (`PATCH /api/plans`; Start also navigates to `/focus`).
  - **Board view** — a `KanbanColumn` per status (`in-progress`/`planned`/`idea`/`done`, `dropped` excluded) rendering `KanbanCard`s with title, tags, and a thin progress bar. Read-only — no drag-and-drop.
  - Clicking "Open" on a plan card (either view) or a sidebar nav item shows `PlanDetail` — full-page read of one plan's status/dates/tags/body/phases (phases are plain checked-off `Checkbox`es, not togglable from here; toggling happens on Focus), plus the same Start/Stop button as `PlanCard`.
  - Malformed entries surface as a non-fatal `Alert`.
  - **Ideas vs. Backlog** are two distinct concepts, kept visually separate in both the sidebar and list view (see decisions.md):
    1. **Ideas** — `ideaEntries`, prose sections parsed client-side from `ideas.md` (split on `---`), read-only, no delete. Clicking one shows its body inline on the Plans page.
    2. **Backlog** — `plans.md` entries with `Status: idea`, created via the sidebar's "Add to backlog" modal (`POST /api/plans`), fully CRUD (deletable via the sidebar's "×", editable like any other plan), and open into the same `PlanDetail` as a `planned`/`in-progress` plan.
    The sidebar shows "Ideas" only when `ideaEntries` is non-empty, and a separate "Backlog" section (with the add/delete actions) always. List view groups `Status: idea` plans under "Backlog" alongside `planned`, and `ideaEntries` under their own "Ideas" grid — same split, just pre-existing there.
- **Focus** (`/focus`) — shows the in-progress plan, or whichever plan is selected in the Plans sidebar/list (`findFocusPlan`: selected plan wins if set, else falls back to the first `in-progress` entry). Toggleable `Checkbox` phases (`PATCH /api/plans`), a `Progress` bar, a Start/Stop toggle (sets `status: in-progress`/`planned`), and a "Mark complete" `Button` (sets `status: done`) once all phases are checked. Each phase row also has a hover-revealed copy button (`FocusPhaseItem`) that copies a one-line AI handoff prompt — `Build phase <n> of plan "<plan title>" in papercamp/plans.md` — to the clipboard. Deliberately minimal: the action, which phase, and where to find it, nothing else — no phase text duplicated in the prompt, since the AI reads it directly from the file once it's there.
- **Settings** (`/settings`) — fetches `/api/config` and shows `projectName` with a `Stamp`, `initializedAt`, or a warning `Alert` if unconfigured. Also has a "Project Icon" section: upload an SVG/PNG/JPG/GIF/WebP via file picker, previewed immediately and persisted through `POST /api/icon` to `.paper-camp/assets/icon.<ext>`. The uploaded icon (if any) replaces the default folder icon in the nav island and Plans sidebar header, next to the project name (read from this repo's own `package.json` `name`, kebab-case title-cased, via `/api/package-name` — falls back to "Paper Camp").

Sidebar navigation is a bottom-floating `NavigationIsland`. The Plans sidebar is only visible on the Plans route. No header, no persistent sidebar — just the content area and the bottom island.

**Container depth:** `Layout` provides the full-page parchment background with `showPage={false}` (we manually wrap `<Outlet />` in `<Page texture="speckle">` for the content area). Per-plan `Card`s are the only nesting inside that.

---

## Current implementation status

**Built and tested:**
- `src/types`, `src/core/schemas.ts`, `src/core/parser.ts`, `src/core/serializer.ts`, `src/core/scaffold.ts`, `src/core/index.ts`
- `src/cli/index.ts` — `init`, `dev` (real, see below), `add plan`
- `src/cli/dev-server.ts` — static + API server for installed consumers
- `vite.config.ts` cli build entry (with a `node:*`-matching external function, not a hardcoded list), so `pnpm build` produces a working `dist/cli/index.js` with shebang intact
- `src/app` — router, headerless/sidebarless Layout shell with a bottom `NavigationIsland`, three pages (Plans, Focus, Settings), dev-time API middleware
- Plans page: list/board view toggle, plan CRUD (create backlog item, delete, patch phases/status), `PlanDetail` full-page view, collapsible Closed section, separate Ideas (from `ideas.md`) and Backlog (idea-status plans) groupings
- Focus page: active-plan resolution, phase toggling, mark-complete, per-phase AI handoff copy-prompt button
- Settings page: project icon upload/display (`/api/icon`), project name branding sourced from `package.json` (`/api/package-name`) and shown in both the nav island and Plans sidebar
- `vite.app.config.ts` builds the SPA to `dist/app`; `pnpm build` runs all three builds (`tsc`, core/cli lib build, app SPA build)
- `public/fonts/Luminari-Regular.woff` vendored so paper-ui's display font actually loads instead of silently falling back
- Vitest coverage for the parser/schema validation (valid entries, malformed-field warnings, checkbox phases, progress log grouping)
- Manually smoke-tested: `init` (already-initialized guard, no-clobber on `ideas.md`), `add plan`, the full dashboard driven through a headless browser against both `pnpm dev` and the built package's `paper-camp dev` in a fresh temp project

**Known gaps:**
- Health/momentum gauges (no paper-ui component yet)
- No favicon (`index.html` references `/favicon.svg`, which doesn't exist — harmless 404, cosmetic only)
