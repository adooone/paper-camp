# Paper Camp — Technical Reference

The philosophy and intent live in [papercamp/ideas/](./ideas/). This document covers the concrete shape of the system: folders, files, commands, and stack.

---

## Per-file plan/idea storage architecture

Plans and ideas have outgrown the monolithic-file pattern. Each plan and each idea gets
its own markdown file with YAML frontmatter for metadata, replacing the ad-hoc `**Field:**
value` line grammar. The files that are read as a log/reference (`decisions.md`,
`open-questions.md`, `progress.md`, `about.md`) stay monolithic — the per-file argument
doesn't apply to append-only or single-document files.

### Directory layout

```
papercamp/
├── about.md                    # technical reference — stays one file, prose
├── decisions.md                # decision log — stays one file, append-only
├── open-questions.md           # open questions — stays one file, append-only-ish
├── progress.md                 # changelog — stays one file, append-only timeline
├── config.json                 # moved from .paper-camp/ — machine config (nextId, defaultAgents, port, projectName)
├── assets/
│   └── icon.svg                # moved from .paper-camp/assets/
├── plans/
│   ├── index.md                # generated — id/title/status/tags only, never hand-edited
│   ├── FEAT-24.md              # YAML frontmatter + markdown body
│   ├── FEAT-23.md
│   ├── FIX-2.md
│   └── archive/
│       ├── FEAT-1.md           # moved here verbatim on done/dropped, no rewrite
│       └── FEAT-2.md
└── ideas/
    ├── index.md                # generated — id/title only
    ├── IDEA-20.md              # YAML frontmatter + markdown body
    └── IDEA-17.md
```

### Filename convention

**Id-only, uppercase**: `FEAT-24.md`, `IDEA-20.md`, `FIX-3.md`.

- Stable across renames — if a plan's title changes the file path doesn't, so existing
  references (git history, agent tool calls, URL bookmarks) never break.
- Shorter than id+slug — easier for agents to reference in file tool calls.
- The generated index provides the id → title mapping for human readability.

### YAML frontmatter format

Each per-plan/per-idea file starts with a `---`-delimited YAML frontmatter block
containing all structured metadata. The markdown body below frontmatter stays exactly as
today — phases as a `- [ ]`/`- [x]` checklist, description and log as prose. The
frontmatter is parsed by a real YAML library and validated against zod schemas (see
`src/core/frontmatter-schemas.ts`), which are the single source of truth.

Example plan file (`papercamp/plans/FEAT-24.md`):

```markdown
---
id: FEAT-24
title: Plan storage architecture
kind: feat
status: in-progress
idea: IDEA-20
agent: opencode
created: 2026-06-28
updated: 2026-06-28
tags: [core, cli, plans, ideas]
---

Description and rationale...

### Phases
- [ ] Phase 1: Design per-file schema
- [x] Phase 2: Build frontmatter parser

### Log
- 2026-06-28: Initial design drafted
```

Example idea file (`papercamp/ideas/IDEA-20.md`):

```markdown
---
id: IDEA-20
title: Plan storage architecture
---

Full prose body...
```

#### Plan frontmatter JSON Schema (generated from zod)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id":      { "type": "string", "description": "Permanent plan ID, e.g. FEAT-24" },
    "title":   { "type": "string", "description": "Human-readable plan name, e.g. \"Plan storage architecture\"" },
    "kind":    { "type": "string", "enum": ["feat","fix","chore","docs","refactor"], "description": "Plan kind matching Conventional Commits types" },
    "status":  { "type": "string", "enum": ["idea","planned","in-progress","review","done","dropped"], "description": "Current lifecycle status" },
    "idea":    { "type": "string", "description": "IDEA-N backlink if this plan grew out of an idea" },
    "agent":   { "type": "string", "enum": ["claude-code","opencode"], "description": "Per-plan agent override" },
    "created": { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Creation date (YYYY-MM-DD)" },
    "updated": { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Last significant update date (YYYY-MM-DD)" },
    "tags":    { "type": "array", "items": { "type": "string" }, "description": "Tagging categories" }
  },
  "required": ["id", "title", "kind", "status", "created"],
  "additionalProperties": false
}
```

Source: `src/core/frontmatter-schemas.ts` — the zod schemas there are the single source
of truth; the JSON Schema above is generated from them via zod v4's built-in
`toJSONSchema()`.

#### Idea frontmatter JSON Schema (generated from zod)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id":    { "type": "string", "description": "Permanent idea ID, e.g. IDEA-20" },
    "title": { "type": "string", "description": "Short idea headline (3-6 words)" }
  },
  "required": ["id", "title"],
  "additionalProperties": false
}
```

### Index files

`papercamp/plans/index.md` and `papercamp/ideas/index.md` are generated on every write —
never hand-edited. They provide a fast overview without scanning every per-plan file:

```markdown
# Plans

| Id | Title | Status | Tags |
|---|---|---|---|
| FEAT-24 | Plan storage architecture | in-progress | core, cli, plans, ideas |
| FEAT-23 | Resolve open questions from Docs | idea | app, docs |
```

Only id, title, status, and tags are listed — no bodies, no phases. This is what the
dashboard's list view and an agent's first "what's going on here" pass actually read.

### Archive mechanism

A plan moving to `done` or `dropped` is a **file move** — the file is moved from
`papercamp/plans/` to `papercamp/plans/archive/` verbatim, with no parse-and-re-serialize
step. This preserves the file byte-for-byte including any hand-written formatting beyond
what the serializer can produce.

Ideas don't archive — a done idea just has a linked done plan; the idea entry's own shape
doesn't change.

### Config migration

Config was previously stored in `.paper-camp/config.json` and assets in `.paper-camp/assets/`.
These have been moved into the visible `papercamp/` directory:

- `papercamp/config.json` — machine config (nextId, defaultAgents, port, projectName, initializedAt, version)
- `papercamp/assets/icon.*` — project icon files

This eliminates the confusion of having two top-level project directories with different
visibility conventions. The config schema (zod `paperCampConfigSchema` in
`src/core/schemas.ts`) stayed the same — only the file path changed.

### Migration plan

See `papercamp/plans/FEAT-24.md` for the phased migration. The
seven phases are:

1. Design per-file schema, directory layout, and migration plan (this document)
2. Build frontmatter parser/serializer
3. Generate index files
4. Implement archive as file move
5. Update CLI and dashboard API routes
6. Move `.paper-camp/` config and assets into `papercamp/` (done)
7. Write and run one-time migration script (splits current monolithic files)

---

## Two directories, two jobs

### `papercamp/` — the project's memory (versioned, human + AI readable)

Lives at the repo root. Plain markdown, committed alongside the code it describes.

| File | Purpose |
|------|---------|
| `plans/` | Per-plan files with YAML frontmatter — what's being built, one file per plan. |
| `ideas/` | Per-idea files with YAML frontmatter — the "why" behind the project. |
| `progress.md` | Running log of what's done, in chronological order. |
| `decisions.md` | Choices made and the reasoning behind them — the record that prevents re-litigating settled questions. |
| `open-questions.md` | Unresolved items that need a decision before work can proceed. |

No numbering scheme, no status-icon tables, no separate index file — the folder itself is the index. A file is either current or it isn't; history is git's job, not a "Status: PENDING/IN_PROGRESS/COMPLETED" field inside the document.

---

## Storage decision: markdown, not a database

**Decision:** the `papercamp/` files are the single source of truth. No SQLite, no JSON store, no sync layer. The dashboard parses the markdown live, on every read.

**Why not a database:** the core promise is that any AI assistant — Claude Code, Cursor, whatever's open in the terminal — can read and edit project memory with zero setup, using its normal file tools. A database forces a custom MCP server or query tool into every AI session just to touch the data, and it kills meaningful git diffs (binary/opaque blobs vs. readable history). Markdown is the only format that's human-readable, AI-readable-with-no-tooling, and git-diffable at once — that's non-negotiable given the project's philosophy.

**Why not a cache either:** for a solo project's planning files (a handful of small `.md` files), parsing on every dashboard request is fast enough that an index/cache buys nothing but complexity. If that ever stops being true at scale, the fix is a disposable, gitignored index rebuilt from the files on change — never a second source of truth. Not needed for v1.

**How structure is added without losing the prose:** Plans and ideas use per-file YAML frontmatter — the schema, required fields, and example files are covered in `## Per-file plan/idea storage architecture` above. The three remaining monolithic files (`decisions.md`, `open-questions.md`, `progress.md`) stay monolithic because they are append-only logs rather than entity collections: there is no per-entry archive move, ID-based lookup, or rename needed, so splitting each entry into its own file adds path-management overhead without enabling any new capability. Each record in those files uses a lightweight `## Heading` + `**Field:** value` block grammar instead:

```markdown
## <Title>

**Field:** value
**Field:** value

Free-form prose body.
```

The parser reads a `## Heading`, then collects consecutive `**Key:** value` lines immediately below it (stops at the first blank line or non-matching line), and treats everything after as the record's markdown body. Fields are validated per-file with a zod schema — unknown or missing required fields surface as a dashboard warning, never a hard crash.

Dates are always `YYYY-MM-DD`.

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

### `papercamp/config.json` — local config (not the memory)

Holds machine state, not project narrative, in `papercamp/config.json`.

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
| `paper-camp init [project-name] [-i, --intent <text>]` | Creates `papercamp/config.json`, `papercamp/plans/` (with `index.md` and `archive/` subdir), `papercamp/ideas/` (with `index.md`), and `papercamp/{progress,decisions,open-questions}.md`. `--intent` seeds `ideas/index.md` with the one-line description; everything else starts empty for the AI/human to fill in during the first session — the CLI does not call an LLM itself (see "Storage decision" below for why init stays this thin). Refuses to run if `papercamp/config.json` already exists, and never overwrites existing files. |
| `paper-camp dev [-p, --port <number>]` | Starts a plain `node:http` server (`src/cli/dev-server.ts`): `/api/*` via `createApiMiddleware`, everything else served statically from the built `dist/app`, falling back to `index.html` for unknown paths (SPA routing). Defaults to port 3333. |
| `paper-camp add plan <name>` | Writes a new `papercamp/plans/<ID>.md` file with YAML frontmatter (`id`, `title`, `kind`, `status: idea`, `created`) and an empty body, assigning the next ID from `config.json`'s `nextId` counter. |

---

## Package layout

Source tree under `src/`:

- `src/types/index.ts` — shared types: `PlanEntry` (now with optional `kind: PlanKind`, `id` — its `<KIND>-<N>` stamp — and `idea`, a backlink to the `IDEA-N` it grew out of), `PlanKind`/`PLAN_KINDS` (`feat | fix | chore | docs | refactor`, matching Conventional Commits' type strings), `IdeaEntry` (`id`, `title`, `body`, derived `status: 'planned' | 'done'`), `DecisionEntry`, `OpenQuestionEntry`, `ProgressEntry`, `PhaseItem` (`text` plus an optional `description` for the collapsible long form), `PaperCampConfig` (now with an optional `nextId: Record<PlanKind, number>` counter).
- `src/core/schemas.ts` — zod schemas validating the per-entry fields block for each file (see schemas below).
- `src/core/parser.ts` — per-file entry points: `parsePlanFile`/`parseIdeaFile` (parse a single YAML-frontmatter plan/idea file, validate fields with zod, collect warnings instead of throwing); `readAllPlanFiles`/`readAllIdeaFiles` (scan `plans/`/`ideas/` dirs, including `plans/archive/`, calling the per-file parsers); `readPlansMerged`/`readIdeasMerged` (the primary API entry points — merge per-file entries with a monolithic fallback, deduplicating by id/title so repos mid-migration keep working). Still-active monolithic parsers for non-migrated files: `parseDecisions`/`parseOpenQuestions`/`parseProgress` (read `decisions.md`/`open-questions.md`/`progress.md`). Other helpers: `parseRawEntries` (generic `## heading` + fields + body + `### Phases` splitter, backing the monolithic parsers), `parseFrontmatter` (low-level YAML frontmatter reader), `deriveIdeaStatuses` (marks an idea "done" once every plan whose `idea` field references it is `done`/`dropped`). Back-compat fallbacks for plans/ideas (only called by the Merged functions when the per-file dirs are empty): `parsePlans`/`parseIdeas`.
- `src/core/serializer.ts` — per-file writers: `formatPlanFile`/`formatIdeaFile` (produce a YAML-frontmatter + body file for a new or updated plan/idea — used by `add plan`/`add idea`, PATCH status flows, and the migration path); `formatPlansIndex`/`formatIdeasIndex` (rewrite `plans/index.md`/`ideas/index.md` summary tables after any mutation); `archivePlanFile` (move a per-file plan to `plans/archive/`); `serializeFrontmatter` (low-level YAML serializer). Still-active monolithic writers for non-migrated files: `formatDecisionEntry`/`formatOpenQuestionEntry`/`formatProgressEntry` plus `appendBlock` (append to `decisions.md`/`open-questions.md`/`progress.md`). `assignPlanId` (reads/increments the per-kind `nextId` counter in `papercamp/config.json` and returns the next `<KIND>-<N>` — a freed ID must never be reassigned). Back-compat exports no longer called by any route: `formatPlanEntry`/`formatPlans` (monolithic plan writers, kept on the lib surface).
- `src/core/scaffold.ts` — `initProject`, used by `init`.
- `src/core/index.ts` — public core API, re-exports all of the above.
- `src/cli/index.ts` — the commander CLI.
- `src/cli/dev-server.ts` — `startDevServer({ root, port })`, the plain `node:http` server `paper-camp dev` runs: reuses `createApiMiddleware` for `/api/*`, serves the built `dist/app` statically otherwise, with an `index.html` SPA fallback.
- `src/app/server/api.ts` — `createApiMiddleware(root)`, a Connect-compatible `(req, res, next)` handler, parsed live from `root`'s `papercamp/`. Shared by both the Vite dev plugin (`pnpm dev`) and `dev-server.ts` (`paper-camp dev`). Routes:
  - `GET /api/plans`, `/api/progress`, `/api/decisions`, `/api/open-questions`, `/api/ideas` (raw `{ content }`), `/api/config`, `/api/package-name` (reads `root`'s own `package.json`, used for nav/sidebar branding).
  - `GET /api/docs` — reads whichever of `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE` exist at the repo root, returns `{ files: [{ name, content }] }`. Backs the Docs page's "Repo Docs" section.
  - `GET /api/configs` — scans the repo root for whichever of a fixed allowlist (`biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`) actually exist, returns `{ files: string[] }`. With a `?name=...` query param (validated against the same allowlist) it instead returns `{ name, content }` for that one file's text. Backs Settings' "Config Files" section.
  - `POST /api/plans` — append a new plan entry (`{ title, content?, kind? }`, `kind` defaulting to `feat`), used by the "Add idea" modal; always written with `Status: idea`. Assigns a permanent `<KIND>-<N>` ID via `assignPlanId`, reading/incrementing the per-kind counter in `papercamp/config.json`.
  - `PATCH /api/plans?title=...` — update an existing entry's `phases` and/or `status`, stamping `Updated` with today's date. Setting `status: in-progress` also auto-demotes any other currently-`in-progress` entry to `planned` in the same write, so only one plan is ever "in focus" at a time.
  - `DELETE /api/plans?title=...` — remove an entry by title.
  - `GET /api/icon` — serves whichever `papercamp/assets/icon.{svg,png,jpg,jpeg,gif,webp}` exists, 404 if none.
  - `POST /api/icon` — accepts `{ dataUri }` (a `data:image/...;base64,...` URI), writes it to `papercamp/assets/icon.<ext>`.
  - `GET /api/activity/stream` — an SSE endpoint backed by `src/app/server/activity.ts`'s `createActivityManager(root)`, which watches `papercamp/`'s files and diffs each one's previously-parsed entries against newly-parsed ones, pushing one `{ message, timestamp }` event per detected change (phase checked off, plan marked done, new open question, etc). Powers the Stack panel's "Live" section.
- `src/app/router.tsx` — code-based TanStack Router tree: one root route rendering paper-ui's `Layout` (header, sidebar, and automatic page-wrap all off; a `navigationIsland` slot holding `ProjectIdentityHeader`, a docs-search `Input` shown only on `/docs`, and ghost `Button`s for the three nav items below) + a manually-wrapped `Page` around `Outlet`, plus a persistent `StackPanel`. Three child routes: Plans (`/`), Docs (`/docs`), Settings (`/settings`) — no Focus route. A single `SidebarShell` is mounted once (not per-route) and swaps its children — `PlansSidebar`/`DocsSidebar`/`SettingsSidebar` — based on `pathname`, so the sidebar's own chrome (header, divider) never remounts on navigation; only the item list inside animates via `framer-motion`, in sync with the main content's route-transition fade/slide.
- `src/app/features/{plans,docs,settings}/` — the page components.
- `src/app/hooks/use-project-identity.ts` — `useProjectIdentity()`, a shared hook returning the project's icon data URI, name, and a `loading` flag, fetched from `/api/icon`/`/api/package-name`. Consolidates what was previously five independent copies of the same fetch logic (`router.tsx`, the three sidebars, `settings-page.tsx`).
- `src/app/services/` — one module per API resource (`plans-api.ts`, `ideas-api.ts`, `docs-api.ts`, `config-api.ts`, `configs-api.ts`, `icon-api.ts`, `package-api.ts`), each a thin typed wrapper around `fetch` for its `/api/*` route. Feature components call these instead of fetching inline.
- `src/app/stores/app-store.ts` — a `zustand` store (`useAppStore`) holding: `plans` (via `/api/plans`); `ideaEntries`, parsed in `src/core/parser.ts` (`parseIdeas`) from `/api/ideas`'s raw content and merged with `plans.entries` via `deriveIdeaStatuses` to compute each idea's planned/done state; the active plan/idea selection; the Plans page's `view: 'list' | 'board'` toggle; `decisions`/`openQuestions`/`progress`/`repoDocs` plus their own loading flags and `load*` actions; the Docs page's `activeDocSection`/`activeDocTitle`/`docSearchQuery`; and Settings' `activeSettingsSection`/`settingsConfigFiles`. Plans and ideas are loaded once from `router.tsx`'s root route on mount; the Docs/Settings slices are loaded by their respective sidebars.
- `src/app/main.tsx` — mounts `RouterProvider` into `#root`, imports `@dendelion/paper-ui/dist/index.css`.
- `src/app/styles/tokens.ts` — the project's design tokens (`fontFamily`, `fontSize`, `lineHeight`, `space`, `color`, `layout`), either mirroring or consuming paper-ui's own `_tokens.scss` scale, used in place of hand-typed literals throughout `src/app`.
- `src/app/components/page-title.tsx` — a real big page-title heading. paper-ui's compiled CSS resets `h1`–`h6` to `font-size: inherit; font-weight: inherit` (Tailwind preflight), so a plain `<h1>` renders at body-text size — this is the deliberate override (Luminari, 2.5rem, 600 weight), shared by all three pages.
- `src/app/components/add-idea-modal.tsx` — a paper-ui `Modal` with title/kind/description fields (kind via a `Select` over `PLAN_KINDS`), used from the Plans sidebar's "Backlog" section "+" button. Submits via `POST /api/plans`.
- `src/app/components/stack-panel.tsx` — see "The Stack panel" under Dashboard below.
- `src/app/components/sidebar-shell.tsx` / `project-identity-header.tsx` / `link-button.tsx` / `markdown.tsx` — the persistent sidebar chrome, the icon+name header reused in both the sidebar and nav island, a shared "link-styled button" (collapsing what used to be a 3x-repeated inline style object across the Docs detail views), and a small Markdown renderer for idea/decision/question bodies.

Build outputs:

- `./` → `dist/core/index.js` — the core library (`vite.config.ts`, lib mode).
- `./` (bin) → `dist/cli/index.js` — the CLI, a third lib entry alongside `core`/`types` (added because the `package.json` `bin` field originally pointed nowhere — `vite.config.ts` only built `core`/`types`). The lib build's `rollupOptions.external` is a function matching any `node:*` import plus a short list of bare specifiers (`react`, `commander`, `zod`, etc.) — needed because `dev-server.ts` pulls in `node:http`/`node:url`, and a hardcoded string list silently missed those the first time.
- `./app` → `dist/app/index.html` + `assets/` — the dashboard SPA, built separately by `vite.app.config.ts` (`pnpm build:app`, also run as part of `pnpm build`). Pure static output, not a JS module — there is no `package.json` export for it; `paper-camp dev`'s static file server is the only consumer.

Path aliases (`vite.config.ts`, `vite.app.config.ts`, `tsconfig.json`): `@core`, `@cli`, `@app`, `@types` under `src/`. Source files themselves use relative imports (`./parser.js`, `../types/index.js`) rather than the aliases, so the same code runs unchanged under `bun src/cli/index.ts` (the `cli` dev script) and the built `dist/cli/index.js`.

**`public/fonts/Luminari-Regular.woff`** is a vendored copy of `@dendelion/paper-ui`'s display font. Their compiled CSS references it via an absolute `url(/fonts/Luminari-Regular.woff)`, so any consuming app has to place that file at its own web root — paper-ui doesn't do this for you. Without it, the build silently falls back to the next font in the stack (Cormorant Garamond → Georgia → serif); the other fonts paper-ui's README mentions (Cormorant Garamond, Caveat, JetBrains Mono) aren't actually self-hosted via `@font-face` in the shipped CSS, just referenced by name, so no extra vendoring was needed for those.

**`src/app/styles/utilities.css`** carries `btn-green`/`btn-orange`/`btn-violet` classes that recolor `Button`'s fill to soft pastel washes with dark text, applied to the Open/Start/Stop/Mark-complete buttons. paper-ui's `Button` has no color prop — its fill is an SVG `<path>` layered behind the label, not a CSS `background` — so these classes target that path directly with `!important` (needed since paper-ui's own hover/active rules outrank a single external class in specificity). Note: paper-ui's own "blue" and "green" watercolor tokens are literally the same hex value upstream, so these three colors are custom hex values, not a reuse of paper-ui's tokens.

Stack:
- **UI**: `@dendelion/paper-ui` (paper/ink/canvas/watercolor design system — textures, warm color tokens, hand-drawn interaction details). The full source lives at `~/dev/paper-ui` (sibling repo), with a component showcase at `src/showcase/pages/components.tsx`. The dashboard currently uses: `Layout` (header/sidebar/automatic Page-wrap all off, `navigationIsland` taking arbitrary content rather than a dedicated nav component), `Island` (the floating chrome wrapping the nav content), `Page` (parchment texture wrapping the content outlet), `Card`, `Stamp`, `Alert`, `Checkbox`, `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Modal`, `Progress`, `ListItem`, `Table` (both its plain `data`/`columns`/`expandable` mode for the phase list and its `board` mode for the kanban/ideas boards), `CodeBlock`, `Icon`/`CheckIcon`/`LightbulbIcon`.
- **Routing**: `@tanstack/react-router`
- **State**: `zustand`
- **Validation**: `zod` — validates the parsed fields block per entry, kept external in the build (like `commander`/`zustand`) rather than bundled.
- **Build/tooling**: Vite (lib build via `vite-plugin-dts` for `core`/`types`, app build via `@vitejs/plugin-react-swc`), TypeScript (strict), Biome (lint/format), Vitest.

---

## Dashboard

Two ways to run it, both serving the same app and the same `/api/*` shape against whatever directory you run them in:

- **`pnpm dev`** (this repo only) — Vite's dev server (`vite.app.config.ts`), with a `configureServer` plugin mounting `createApiMiddleware(process.cwd())`. Used while developing `src/app` itself, with HMR.
- **`paper-camp dev`** (installed package) — `src/cli/dev-server.ts`'s plain `node:http` server, serving the *built* `dist/app` plus the same API middleware. This is what an end user actually runs.

Three pages exist — Plans, Docs, Settings (Focus was dropped; see decisions.md) — plus a persistent Stack panel present on all of them.

- **Plans** (`/`) — fetches `/api/plans`. Has two views, toggled by `ViewToggle` (state lives in `useAppStore`):
  - **List view** (default) — sections by status: "In progress", "Backlog" (`planned` + `idea`), an "Ideas" two-column board (see below), and a collapsed-by-default "Closed" section (`done` + `dropped`). Each plan renders as a `PlanCard` — `Card` with a `PlanIdStamp` (`<KIND>-<N>`) next to the title, a `Stamp` for status (rgba wash + matching dark text), dates/tags, body, a `ProgressBar` computed from `### Phases` checkboxes, an "Open" button, and a Start/Stop button (`PATCH /api/plans`; both stay on the Plans page, opening the plan's `PlanDetail`).
  - **Board view** — paper-ui's `Table` in `board` mode, two columns ("Planned", "In Progress" — `idea` lives in the Ideas board instead, `done`/`dropped` in Closed), rendering `KanbanCard`s with `PlanIdStamp` + title + tags. Read-only — no drag-and-drop.
  - Clicking "Open" on a plan card (either view) or a sidebar nav item shows `PlanDetail` — id/title header, status/dates/tags/body, a progress bar, and the phase list as a `Table` with toggleable `Checkbox`es (`PATCH /api/plans`), a per-phase `PhaseCopyButton`, and `expandable` rows showing each phase's optional `description` in a chalkboard-textured sub-row. A "Mark complete" `Button` appears once every phase is checked. This is the same view a plan opens into everywhere — there's no separate read-only or distraction-free variant anymore.
  - Malformed entries surface as a non-fatal `Alert`.
  - **Ideas vs. Backlog** are two distinct concepts, kept visually separate in both the sidebar and list view (see decisions.md):
    1. **Ideas** — `ideaEntries`, loaded via `readIdeasMerged` from `papercamp/ideas/*.md` per-file entries, each with a derived `status: 'planned' | 'done'` (done only once every plan whose `idea` field references it is `done`/`dropped`). Rendered as a two-column `IdeasBoard` (`Table` in `board` mode, "Planned"/"Done" columns, ordered by file position): each row shows a lightbulb/check `Icon`, the idea's short title, and — if any plan links to it via `idea` — an expand toggle listing every linked plan as a clickable `PlanIdStamp`. Read-only and no delete; clicking the title opens the idea's full body inline on the Plans page.
    2. **Backlog** — per-file plan entries with `status: idea` (from `papercamp/plans/*.md`), created via the sidebar's "Add to backlog" modal (`POST /api/plans`, with a `Kind` `Select`), fully CRUD (deletable via the sidebar's "×", editable like any other plan), and open into the same `PlanDetail` as a `planned`/`in-progress` plan.
    The sidebar shows "Ideas" only when `ideaEntries` is non-empty, and a separate "Backlog" section (with the add/delete actions) always. List view mirrors that split.
- **Docs** (`/docs`) — a documentation browser with a left `DocsSidebar` grouped into four sections: **Repo Docs** (`/api/docs` — `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE`, whichever exist; defaults to `MAIN.md` on first load if present), **Decisions** (`/api/decisions`, a `Stamp` for `decided`/`superseded`, a `superseded` entry links to its `Superseded-by` replacement), **Open Questions** (`/api/open-questions`, a `Stamp` for `open`/`resolved`, cross-linked to/from its `Resolved-by` decision), and **Progress** (`/api/progress`, rendered as a reverse-chronological `ProgressTimeline`). Each section shows "Loading…" while its slice of `useAppStore` is in flight, and an empty-state line once loaded with nothing. A search `Input` in the nav island (visible only on `/docs`) drives full-text search across all four sources, replacing the normal page body with `DocsSearch` results while a query is active.
- **Settings** (`/settings`) — sidebar-driven, mirroring the Docs/Plans sidebar shape. "General" (the default section) shows project info (`/api/config`: `projectName`, version, `initializedAt`, or a warning `Alert` if unconfigured) and a "Project Icon" uploader (SVG/PNG/JPG/GIF/WebP via a hidden file input — paper-ui has no file-input component — previewed immediately and persisted through `POST /api/icon`). A "Config Files" section lists whichever allowlisted config file actually exists in the repo (`GET /api/configs`); selecting one fetches its content (`GET /api/configs?name=...`) and renders it read-only via `CodeBlock`. The uploaded icon (if any) replaces the default folder icon in the nav island and every sidebar header, next to the project name (read from this repo's own `package.json` `name` via `/api/package-name`, falling back to "Paper Camp").

**The Stack panel** (`src/app/components/stack-panel.tsx`) is not a route — it's a fixed, right-docked, full-height panel mounted once in `router.tsx` alongside `Outlet`, present on every page. Default open, collapsible to a small chalkboard tab via an `IconButton`; slides via `framer-motion`. Chalkboard-textured, desk-green gradient background, Luminari header. Two sections: **Active** — the in-progress plan (`findFocusPlan`, same resolution `PlanDetail`'s Start button drives), showing its title and only the current (first incomplete) phase; "No active plan." when none. **Live** — a real-time feed subscribed to `GET /api/activity/stream` (SSE), prepending each new `{ message, timestamp }` event and re-triggering `loadPlans`/`loadProgress` so the rest of the UI stays in sync without polling; entries animate in via `framer-motion`. Hidden entirely when empty.

Sidebar navigation lives in the nav island (top of the `Layout`, not a separate header) — `ProjectIdentityHeader`, an optional docs-search box, and ghost `Button`s for Plans/Docs/Settings. A single persistent `SidebarShell` sits left of the content on every route, swapping its inner item list (`PlansSidebar`/`DocsSidebar`/`SettingsSidebar`) per route rather than remounting the whole sidebar — this is what keeps route transitions from visibly jumping.

**Container depth:** `Layout` provides the full-page background with `showPage={false}` (we manually wrap `<Outlet />` in `<Page texture={{ texture: 'parchment' }}>` for the content area). Per-plan `Card`s, and the Stack panel's own `Card`s, are the only nesting inside that.

---

## Current implementation status

**Built and tested:**
- `src/types`, `src/core/schemas.ts`, `src/core/parser.ts`, `src/core/serializer.ts`, `src/core/scaffold.ts`, `src/core/index.ts`
- `src/cli/index.ts` — `init`, `dev` (real, see below), `add plan`
- `src/cli/dev-server.ts` — static + API server for installed consumers
- `vite.config.ts` cli build entry (with a `node:*`-matching external function, not a hardcoded list), so `pnpm build` produces a working `dist/cli/index.js` with shebang intact
- `src/app` — router, headerless/sidebarless `Layout` shell with a nav-island top bar and a persistent `SidebarShell`, three pages (Plans, Docs, Settings) plus the always-present Stack panel, dev-time API middleware
- Plans page: list/board view toggle, plan CRUD (create backlog item, delete, patch phases/status), `PlanDetail` with interactive phase toggling/mark-complete/per-phase copy-prompt (Focus was folded into it and the standalone route dropped), plan/idea IDs, collapsible Closed section, separate Ideas board and Backlog groupings
- Docs page: Repo Docs/Decisions/Open Questions/Progress sections, cross-linked decisions↔questions, full-text search
- Settings page: project icon upload/display (`/api/icon`), project name branding sourced from `package.json` (`/api/package-name`) shown in the nav island and every sidebar header, dynamic config-file viewer
- Stack panel: active-plan surfacing and a live SSE activity feed, present on every page
- `vite.app.config.ts` builds the SPA to `dist/app`; `pnpm build` runs all three builds (`tsc`, core/cli lib build, app SPA build)
- `public/fonts/Luminari-Regular.woff` vendored so paper-ui's display font actually loads instead of silently falling back
- Vitest coverage for the parser/schema validation (valid entries, malformed-field warnings, checkbox phases, progress log grouping)
- Manually smoke-tested: `init` (already-initialized guard, no-clobber on `ideas.md`), `add plan`, the full dashboard driven through a headless browser against both `pnpm dev` and the built package's `paper-camp dev` in a fresh temp project

**Known gaps:**
- Health/momentum gauges (no paper-ui component yet)
- No favicon (`index.html` references `/favicon.svg`, which doesn't exist — harmless 404, cosmetic only)
