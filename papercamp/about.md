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
    ├── index.md                # generated — id/title/status (status derived from linked plans)
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
frontmatter is parsed by a real YAML library (the `yaml` package) and validated against
zod schemas (`planFrontmatterSchema`/`ideaFrontmatterSchema` in `src/core/schemas.ts`;
`src/core/frontmatter-schemas.ts` survives as a thin re-export barrel so older references
don't break), which are the single source of truth.

Example plan file (`papercamp/plans/FEAT-24.md`):

```markdown
---
id: FEAT-24
title: Plan storage architecture
kind: feat
status: in-progress
created: 2026-06-28
idea: IDEA-20
agent: opencode
updated: 2026-06-28
tags:
  - core
  - cli
  - plans
  - ideas
---

Description and rationale...

### Phases
- [ ] Phase 1: Design per-file schema
- [x] Phase 2: Build frontmatter parser

### Log
- 2026-06-28: Initial design drafted
```

(Key order and the block-style tag list match what `formatPlanFile` actually emits; the
parser accepts any valid YAML, so hand-written flow-style tags parse fine too.)

Example idea file (`papercamp/ideas/IDEA-20.md`):

```markdown
---
id: IDEA-20
title: Plan storage architecture
---

## IDEA-20: Plan storage architecture

Full prose body...
```

(`formatIdeaFile` writes the `## <id>: <title>` heading above the body; existing idea
files all carry it.)

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
    "audited": { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Date of last successful convergence audit (YYYY-MM-DD)" },
    "tags":    { "type": "array", "items": { "type": "string" }, "description": "Tagging categories" }
  },
  "required": ["id", "title", "kind", "status", "created"],
  "additionalProperties": false
}
```

Source: `src/core/schemas.ts` — the zod schemas there are the single source of truth
(`src/core/frontmatter-schemas.ts` is a compat re-export barrel); the JSON Schema above
is generated from them via zod v4's built-in `toJSONSchema()`.

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
never hand-edited (`regenerateIndexes` in `src/app/server/helpers.ts` for the API,
`formatPlansIndex`/`formatIdeasIndex` for the CLI paths). They provide a fast overview
without scanning every per-plan file:

```markdown
# Plans

| Id | Title | Status | Tags |
|---|---|---|---|
| FEAT-23 | Resolve open questions from Docs | idea | app, docs |
| FEAT-24 | Plan storage architecture | in-progress | core, cli, plans, ideas |
```

Rows are sorted by numeric id, ascending. The plans index lists id, title, status, and
tags; the ideas index lists id, title, and the derived planned/done status — no bodies,
no phases. This is what an agent's first "what's going on here" pass actually reads (the
dashboard's list view reads the parsed entries from `/api/plans` instead).

### Archive mechanism

A plan moving to `done` or `dropped` ends with a **file move** — `archivePlanFile`
(`src/core/serializer.ts`) renames `papercamp/plans/<ID>.md` to
`papercamp/plans/archive/<ID>.md`; the move itself has no parse-and-re-serialize step.
One nuance: the dashboard's `PATCH /api/plans` first re-serializes the file to record the
new `status` and stamp `updated`, *then* moves it — so a plan closed through the UI is
rewritten by the serializer on its way to the archive (hand-written formatting the
serializer can't produce doesn't survive that path; only the move step is byte-for-byte).
`paper-camp migrate` writes already-done/dropped entries directly into `archive/`.
Readers treat archived plans as first-class: `readAllPlanFiles` scans both
`plans/` and `plans/archive/`.

Ideas don't archive — a done idea just has a linked done plan; the idea entry's own shape
doesn't change.

### Config migration

Config was previously stored in `.paper-camp/config.json` and assets in `.paper-camp/assets/`.
These have been moved into the visible `papercamp/` directory:

- `papercamp/config.json` — machine config (nextId, defaultAgents, port, projectName, initializedAt, version)
- `papercamp/assets/icon.*` — project icon files

This eliminates the confusion of having two top-level project directories with different
visibility conventions. The config schema (zod `paperCampConfigSchema` in
`src/core/schemas.ts`) stayed the same at migration time — only the file path changed —
and has since grown `nextId` (per-kind ID counters) and `defaultAgents` (per-task
agent/model/effort). Known drift, noted rather than papered over: the dashboard writes an
optional `port` key (`POST /api/config`, present on the `PaperCampConfig` TS type) that
`paperCampConfigSchema` doesn't declare; the schema is only enforced by `init`, so
nothing currently catches the mismatch.

### Migration plan

See `papercamp/plans/archive/FEAT-24.md` (itself archived — the migration shipped) for
the phased migration. All seven phases landed:

1. Design per-file schema, directory layout, and migration plan (this document)
2. Build frontmatter parser/serializer
3. Generate index files
4. Implement archive as file move
5. Update CLI and dashboard API routes
6. Move `.paper-camp/` config and assets into `papercamp/`
7. One-time migration script — now the `paper-camp migrate` CLI command (kept for repos
   still on monolithic files)

This repo has been migrated: no `plans.md`/`ideas.md` remain under `papercamp/`. The
`readPlansMerged`/`readIdeasMerged` monolithic fallback stays in place for repos
mid-migration.

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

Plans and ideas carry permanent `<KIND>-<N>`/`IDEA-N` ids, and each folder has a generated `index.md` — but the index is a disposable summary rebuilt on every write, never a second source of truth. The log files stay id-free and index-free. History is git's job, not a "Status: PENDING/IN_PROGRESS/COMPLETED" field inside a document — lifecycle status lives in plan frontmatter and nowhere else.

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
| `Blocks` | no | id of the plan this question gates (used by the consistency check to flag blocked-but-active plans) |

Body: free prose framing the question and why it matters. Once answered, write the answer as a new entry in `decisions.md`, set `Resolved-by` here, flip `Status` to `resolved` — don't delete the question, it's part of the honest record.

### `papercamp/config.json` — local config (not the memory)

Holds machine state, not project narrative, in `papercamp/config.json`. Editable from
the dashboard's Settings page via `POST /api/config` (`projectName`, `port`,
`defaultAgents`).

```json
{
  "version": "0.1.0",
  "projectName": "paper-camp",
  "initializedAt": "2026-04-29T00:00:00.000Z",
  "nextId": { "feat": 34, "fix": 3, "chore": 2, "docs": 4, "refactor": 5 },
  "defaultAgents": {
    "phase": { "agent": "claude-code", "model": "sonnet", "effort": "medium" },
    "planDraft": { "agent": "claude-code", "model": "fable", "effort": "high" },
    "ideaExtend": { "agent": "claude-code", "model": "opus", "effort": "high" },
    "commitSuggest": { "agent": "claude-code", "model": "sonnet", "effort": "low" }
  }
}
```

`nextId` is the per-kind plan-ID counter `assignPlanId` reads and increments; `port` is
optional (see the schema-drift note under "Config migration" above). Legacy bare-string
`defaultAgents` values (`"phase": "opencode"`) are coerced to the object shape on read.
An optional `autoLogNewFiles: boolean` field gates the opt-in PostToolUse hook (see
"Claude Code native integration" above) — absent or `false` means off.

---

## CLI

Bin entry: `paper-camp` → `dist/cli/index.js`, built with `commander`. Implemented in `src/cli/index.ts`.

| Command | Effect |
|---------|--------|
| `paper-camp init [project-name] [-i, --intent <text>]` | Creates `papercamp/config.json`, `papercamp/plans/` (with `index.md` and `archive/` subdir), `papercamp/ideas/` (with `index.md`), and `papercamp/{progress,decisions,open-questions}.md`. `--intent` seeds `ideas/index.md` with the one-line description (note: the first index regeneration replaces that prose with the generated id/title/status table); everything else starts empty for the AI/human to fill in during the first session — the CLI does not call an LLM itself (see "Storage decision" below for why init stays this thin). Refuses to run if `papercamp/config.json` already exists, and never overwrites existing files. |
| `paper-camp dev [-p, --port <number>]` | Starts a plain `node:http` server (`src/cli/dev-server.ts`): `/api/*` via `createApiMiddleware`, everything else served statically from the built `dist/app`, falling back to `index.html` for unknown paths (SPA routing). Defaults to port 3333. Errors out with a pointer to `pnpm build` if `dist/app` is missing; kills any running agent task on SIGINT/SIGTERM. |
| `paper-camp add plan <name> [-k, --kind <kind>]` | Writes a new `papercamp/plans/<ID>.md` file with YAML frontmatter (`id`, `title`, `kind` — default `feat`, `status: idea`, `created`) and an empty body, assigning the next ID from `config.json`'s `nextId` counter, then regenerates `plans/index.md`. |
| `paper-camp migrate` | One-time migration for repos still on monolithic files: splits `papercamp/plans.md`/`ideas.md` into per-file entries (done/dropped plans go straight to `plans/archive/`), skips entries without ids and files that already exist, regenerates both indexes, and empties each monolithic file only after a clean run (no skips or warnings). |
| `paper-camp audit` | Runs the convergence-audit agent over every `review`/`done` plan, skipping plans whose `audited` stamp is at least as new as the file's mtime; stamps `audited` on success and prints an audited/skipped/failed summary with any gap phases appended. |

---

## Claude Code native integration

Paper Camp plugs into Claude Code itself rather than only offering a dashboard: any
project with a `papercamp/` folder gets its memory loaded and kept current with zero
prompting. `paper-camp init` scaffolds three surfaces (see `scaffoldClaudeCodeIntegration`
in `src/core/scaffold.ts`, static contents in `src/core/templates.ts`), each following
init's existing no-clobber contract — an already-present file is left untouched.

1. **The skill** (`.claude/skills/paper-camp/SKILL.md`) — auto-discovered whenever the
   working directory contains `papercamp/`. Instructs the assistant to read `plans/`,
   `ideas/`, `decisions.md`, and `open-questions.md` before working, and to keep the
   active plan's phases and `progress.md` current as it goes (this repo's own copy at
   `.claude/skills/paper-camp/SKILL.md` is the source the template mirrors verbatim).
2. **The SessionStart hook** (`.claude/settings.json`) — shells out to
   `paper-camp session-focus` (`src/cli/session-focus.ts`, exporting `buildSessionFocus`)
   on every new session. It *derives* a focus block from live data rather than reading a
   hand-maintained file: the in-progress plan (preferring the one tied to the current
   feature branch via the git manager's `getFeatureBranchPlanId`, falling back to
   `findFocusPlan` over the per-file plans) plus the last 3 `progress.md` bullets. Prints
   a `hookSpecificOutput.additionalContext` JSON payload for Claude Code to inject, or
   exits silently if no `papercamp/plans/` directory exists.
3. **The PostToolUse hook** (`.claude/settings.json`, matcher `Write`) — shells out to
   `paper-camp post-tool-use-log` (`src/cli/post-tool-use-log.ts`, exporting
   `logNewFile`), **off by default**. It only fires when `papercamp/config.json` sets
   `autoLogNewFiles: true`, and even then only for a `Write` whose `structuredPatch` is
   empty (Claude Code's signal that the tool created the file rather than editing
   existing content) — so reads, edits, searches, and bash never match. Logs
   `New file: <relative path>` to `progress.md` when it fires.

Both hook shell-outs resolve the `paper-camp` binary via `$CLAUDE_PROJECT_DIR`, pointing
at `node_modules/.bin/paper-camp` in the consuming project, since a fresh install only
ships `dist/cli/index.js`, not a `src/` tree to run against directly.

(An earlier fourth surface — a git post-commit auto-logger — was removed: writing a
`Commit:` bullet to the tracked `progress.md` after every commit re-dirtied the working
tree on each commit, an unbreakable loop. Git history and the agent's own per-phase
progress entries already cover that ground.)

Complements [[FEAT-32]] (the MCP server, if it exists in a given project): the skill's
file-access instructions are written thin enough to delegate to it rather than
reimplementing file access.

---

## Package layout

Source tree under `src/`:

- `src/types/index.ts` — shared types: `PlanEntry` (with optional `kind: PlanKind`, `id` — its `<KIND>-<N>` stamp — `idea` backlink, per-plan `agent` override, `audited` stamp, `log`/`clarifications` entries), `PlanKind`/`PLAN_KINDS` (`feat | fix | chore | docs | refactor`, matching Conventional Commits' type strings), `IdeaEntry` (`id`, `title`, `body`, derived `status: 'planned' | 'done'`), `DecisionEntry`, `OpenQuestionEntry`, `ProgressEntry`, `PhaseItem` (`text`, optional `description` for the collapsible long form, optional `source: 'review'`), `PaperCampConfig` (`nextId: Record<PlanKind, number>`, optional `port`, `defaultAgents`), plus the agent/status/git vocabulary the app server shares with the UI: `AGENT_IDS`/`AgentConfig`/`DefaultAgentsMap`/`DEFAULT_AGENTS`/`TaskKind`/`AgentTaskState`, `CheckStatus`/`CheckResult`/`CheckName`, `GitStatusEntry`/`BranchHygieneStatus`, `ConsistencyIssue`, `EnvEntry`.
- `src/core/schemas.ts` — all the zod schemas: the `**Field:**`-block schemas for the monolithic files (`planFieldsSchema` — legacy, `decisionFieldsSchema`, `openQuestionFieldsSchema`), the per-file frontmatter schemas (`planFrontmatterSchema`/`ideaFrontmatterSchema` — the single source of truth for the per-file format), and `paperCampConfigSchema`/`agentConfigSchema` for `config.json`. `src/core/frontmatter-schemas.ts` is a thin re-export barrel kept so older references to that path don't break.
- `src/core/parser.ts` — pure string → data parsing, no filesystem access: `parsePlanFile`/`parseIdeaFile` (parse a single YAML-frontmatter plan/idea file, validate with zod, collect warnings instead of throwing; plan bodies get their `### Phases`/`### Log`/`### Clarifications` sections extracted), `parseFrontmatter` (low-level YAML frontmatter reader). Still-active monolithic parsers for non-migrated files: `parseDecisions`/`parseOpenQuestions`/`parseProgress`, backed by `parseRawEntries` (generic `## heading` + fields + body splitter). `findConsistencyIssues` cross-checks decisions/questions/plans (superseded-decision references, questions blocking active plans). Back-compat monolithic fallbacks for plans/ideas: `parsePlans`/`parseIdeas` (only reached via the Merged readers when the per-file dirs are empty).
- `src/core/readers.ts` — the filesystem layer on top of parser.ts: `readAllPlanFiles`/`readAllIdeaFiles` (scan `plans/` — including `plans/archive/` — and `ideas/`, skipping `index.md`), and `readPlansMerged`/`readIdeasMerged` (the primary API entry points — merge per-file entries with a monolithic fallback, deduplicating by id/title so repos mid-migration keep working).
- `src/core/idea-status.ts` — `deriveIdeaStatuses` (marks an idea "done" once every plan whose `idea` field references it is `done`/`dropped`). Pure and kept out of parser.ts so client-bundled importers (app-store) don't pull in Node-only file code; note it is *not* re-exported from `src/core/index.ts` — consumers import it by path (the barrel omission isn't documented anywhere as intentional).
- `src/core/env.ts` — `parseEnv`/serialize helpers for `.env` files (`KEY=value` lines, quoting rules), backing the Settings page's Environment Variables editor via `/api/env`.
- `src/core/serializer.ts` — per-file writers: `formatPlanFile`/`formatIdeaFile` (produce a YAML-frontmatter + body file — used by `add plan`, `migrate`, `POST /api/plans`, `POST /api/ideas`, and every PATCH rewrite via the server's `planFileInput`/`writePlanFile` helpers); `formatPlansIndex`/`formatIdeasIndex` (rewrite the index tables after any mutation); `archivePlanFile` (rename a per-file plan into `plans/archive/`); `serializeFrontmatter` (low-level YAML serializer); `assignPlanId` (reads/increments the per-kind `nextId` counter in `papercamp/config.json` and returns the next `<KIND>-<N>` — a freed ID must never be reassigned; calls are chained through a module-level promise so same-process callers can't mint duplicates, while cross-process races — CLI vs dev server — are an accepted gap). Still-active monolithic writers: `formatDecisionEntry`/`formatOpenQuestionEntry`/`formatOpenQuestions`/`formatProgressEntry` plus `appendBlock` (used by the open-question resolve flow). Back-compat exports no longer called by anything: `formatPlanEntry`/`formatPlans` (monolithic plan writers, kept on the lib surface).
- `src/core/scaffold.ts` — `initProject`, used by `init`; also `scaffoldClaudeCodeIntegration`, which writes the four Claude Code native-integration surfaces (see above) from the static templates in `src/core/templates.ts`.
- `src/cli/session-focus.ts` / `post-tool-use-log.ts` — the bodies behind the `session-focus` and `post-tool-use-log` CLI subcommands the scaffolded hooks shell out to (see "Claude Code native integration" above).
- `src/core/index.ts` — public core API; re-exports `env`/`parser`/`readers`/`schemas`/`scaffold`/`serializer` and the shared types (`idea-status.ts` and `frontmatter-schemas.ts` are imported by path, not via the barrel).
- `src/cli/index.ts` — the commander CLI.
- `src/cli/dev-server.ts` — `startDevServer({ root, port })`, the plain `node:http` server `paper-camp dev` runs: reuses `createApiMiddleware` for `/api/*`, serves the built `dist/app` statically otherwise, with an `index.html` SPA fallback.
- `src/app/server/api.ts` — `createApiMiddleware(root)`, a Connect-compatible `(req, res, next)` handler, parsed live from `root`'s `papercamp/`. Shared by both the Vite dev plugin (`pnpm dev`) and `dev-server.ts` (`paper-camp dev`). It wires up the server-side managers — `activity.ts` (fs-watch SSE), `git.ts` (working-tree/branch operations), `status.ts` (lint/format/test check runner), `agent.ts` + `agent-hooks.ts` (agent task orchestration: branch-per-plan setup, per-phase commits, audit stamping) — and dispatches to per-resource route modules under `src/app/server/routes/`:
  - `routes/reads.ts` (plain GETs): `/api/plans` (`readPlansMerged`), `/api/ideas` (`readIdeasMerged` — parsed `{ entries, warnings }`, no longer raw file content), `/api/progress`, `/api/decisions`, `/api/open-questions`, `/api/consistency` (`findConsistencyIssues`), `/api/config` (with legacy bare-string `defaultAgents` coerced to the object shape), `/api/package-name` (reads `root`'s own `package.json` `name`, used for nav/sidebar branding), `/api/docs` (whichever of `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE` exist at the repo root — backs the Docs page's "Repo Docs" section), `/api/configs` (allowlist scan: `biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`).
  - `routes/plans.ts` — `POST /api/plans` (new per-file plan `{ title, content?, kind? }`, always `status: idea`, ID via `assignPlanId`, index regen; 409s on branch-hygiene conflicts). `PATCH /api/plans?title=...` (update `phases`/`status`/`log`/`agent`, stamp `updated`; setting `in-progress` demotes any other in-progress plan to `planned`; setting `done`/`dropped` re-checks branch conflicts, then archives the file via `archivePlanFile`). `DELETE /api/plans?title=...` (unlink the per-file entry, regen indexes).
  - `routes/ideas.ts` — `POST /api/ideas` (new per-file idea; next `IDEA-N` derived from the max existing id, `formatIdeaFile`, index regen).
  - `routes/icon.ts` — `GET /api/icon` (serves whichever `papercamp/assets/icon.{svg,png,jpg,jpeg,gif,webp}` exists, 404 if none); `POST /api/icon` (accepts `{ dataUri }`, writes `papercamp/assets/icon.<ext>`).
  - `routes/config.ts` — `POST /api/config` (update `port`/`projectName`/`defaultAgents` in `config.json`, migrating any legacy single `defaultAgent` key); `GET /api/configs?name=...` (one allowlisted file's content — backs Settings' "Config Files" section).
  - `routes/env.ts` — `GET`/`POST /api/env` (read/write the repo-root `.env` via `src/core/env.ts` — backs Settings' Environment Variables editor).
  - `routes/git.ts` — `GET /api/git/status` (changed files + branch + ahead count + `branchHygiene`); `POST /api/git/commit` (stage selected paths, commit title/message), `/api/git/push`, `/api/git/sync` (clean tree: inline checkout-main + fast-forward; dirty tree: launches an agent task), `/api/git/suggest-commit-message` (agent-written title/body from the actual diff).
  - `routes/status.ts` — `GET /api/status` (lint/format/test check results), `POST /api/status/check` (run one), `POST /api/status/fix` (biome --write), and `GET /api/activity/stream` — an SSE endpoint backed by `activity.ts`, which recursively watches `papercamp/` (per-file trees, archive, and the monolithic files alike) and pushes a debounced generic "changed" tick; the one consumer (the Stack panel) ignores the payload and refetches everything. It deliberately does not synthesize a human-readable activity feed anymore.
  - `routes/agent.ts` — `GET /api/agent/status` plus `POST /api/agent/launch` (one phase), `launch-audit`, `launch-reconcile` (rewrite stale plan prose, preview-gated), `launch-audit-all`, `launch-draft` (plan from idea), `launch-extend` (idea body), `launch-run-all` (all phases with per-phase commits), and `stop`.
  - `routes/docs.ts` — `POST /api/open-questions/resolve?title=...` (validates, appends the new decision to `decisions.md`, flips the question to `resolved` with `Resolved-by` — refuses to write while the file has parse warnings).
- `src/app/router.tsx` — code-based TanStack Router tree: one root route rendering paper-ui's `Layout` (header, sidebar, and automatic page-wrap all off; a `navigationIsland` slot holding `ProjectIdentityHeader`, a docs-search `Input` shown only on `/docs`, and ghost `Button`s for the four nav items) + a manually-wrapped `Page` around `Outlet`, plus a persistent `StackPanel` (whose open state pads the content column by `layoutConfig.stackPanelWidth`). Four child routes: Plans (`/`), Review (`/review`), Docs (`/docs`), Settings (`/settings`). A single `SidebarShell` is mounted once (not per-route) and swaps its children — `PlansSidebar`/`ReviewSidebar`/`DocsSidebar`/`SettingsSidebar` — based on `pathname`, so the sidebar's own chrome (header, divider) never remounts on navigation; only the item list inside animates via `framer-motion`, in sync with the main content's route-transition fade/slide.
- `src/app/features/{plans,docs,settings}/` — the page components; the Review page lives in `features/plans/review-page.tsx` since it renders the same `PlanCard`/`PlanDetail` pieces.
- `src/app/hooks/` — `useProjectIdentity()` (the project's icon data URI, name, and a `loading` flag from `/api/icon`/`/api/package-name`; consolidates what was previously five independent copies of the same fetch logic) and `useActionFeedback()` (idle/loading/success/error state machine for one-shot action buttons like Draft plan / Extend with AI).
- `src/app/services/` — one module per API resource (`plans-api.ts`, `ideas-api.ts`, `docs-api.ts`, `config-api.ts`, `config-files-api.ts`, `icon-api.ts`, `package-api.ts`, `git-api.ts`, `status-api.ts`, `agent-api.ts`, `env-api.ts`), each a thin typed wrapper around `fetch` for its `/api/*` route. Feature components call these instead of fetching inline.
- `src/app/stores/app-store.ts` — a `zustand` store (`useAppStore`) holding: `plans` (via `/api/plans`); `ideaEntries` (parsed entries from `/api/ideas`, run through `deriveIdeaStatuses` against `plans.entries` to compute each idea's planned/done state); the active plan/idea selection; the Plans page's `view: 'list' | 'board'` toggle; `decisions`/`openQuestions`/`progress`/`repoDocs` plus their own loading flags and `load*` actions; the Docs page's `activeDocSection`/`activeDocTitle`/`docSearchQuery`; Settings' `activeSettingsSection` (`general`/`env`/`config:<file>`) and `settingsConfigFiles`; the check-status slice (`status`, `runCheck`, `fixQuality`) and `consistency` findings; the git slice (`gitStatus`/`gitBranch`/`gitAhead`/`gitBranchHygiene`); and the agent slice (`agentStatus` plus the `launch*`/`stopAgent` actions). Plans and ideas are loaded once from `router.tsx`'s root route on mount; the Docs/Settings slices are loaded by their respective sidebars; the Stack panel loads and live-refreshes the status/git/agent slices off the SSE stream.
- `src/app/main.tsx` — mounts `RouterProvider` into `#root`, imports `@dendelion/paper-ui/dist/index.css`.
- `src/app/styles/tokens.ts` — the project's design tokens (`fontFamily`, `fontSize`, `lineHeight`, `space`, `color`, `layout`), either mirroring or consuming paper-ui's own `_tokens.scss` scale, used in place of hand-typed literals throughout `src/app`.
- `src/app/components/page-title.tsx` — a real big page-title heading. paper-ui's compiled CSS resets `h1`–`h6` to `font-size: inherit; font-weight: inherit` (Tailwind preflight), so a plain `<h1>` renders at body-text size — this is the deliberate override (Luminari, 2.5rem, 600 weight), shared by all four pages.
- `src/app/components/add-idea-modal.tsx` — a paper-ui `Modal` with title/kind/description fields (kind via a `Select` over `PLAN_KINDS`), used from the Plans sidebar's "Backlog" section "+" button. Submits via `POST /api/plans`. Its sibling `features/plans/components/create-idea-modal.tsx` (title/description only, no kind) backs the sidebar's "Ideas" "+" button and submits via `POST /api/ideas`.
- `src/app/components/stack-panel.tsx` — see "The Stack panel" under Dashboard below.
- `src/app/components/sidebar-shell.tsx` / `project-identity-header.tsx` / `link-button.tsx` / `markdown.tsx` / `copy-prompt-button.tsx` — the persistent sidebar chrome, the icon+name header reused in both the sidebar and nav island, a shared "link-styled button" (collapsing what used to be a 3x-repeated inline style object across the Docs detail views), a small Markdown renderer for idea/decision/question bodies, and a clipboard button for agent prompts (per-phase copy, fix prompts).

Build outputs:

- `./` → `dist/core/index.js` — the core library (`vite.config.ts`, lib mode).
- `./` (bin) → `dist/cli/index.js` — the CLI, a third lib entry alongside `core`/`types` (added because the `package.json` `bin` field originally pointed nowhere — `vite.config.ts` only built `core`/`types`). The lib build's `rollupOptions.external` is a function matching any `node:*` import plus a short list of bare specifiers (`react`, `commander`, `zod`, etc.) — needed because `dev-server.ts` pulls in `node:http`/`node:url`, and a hardcoded string list silently missed those the first time.
- `./app` → `dist/app/index.html` + `assets/` — the dashboard SPA, built separately by `vite.app.config.ts` (`pnpm build:app`, also run as part of `pnpm build`). Pure static output, not a JS module — there is no `package.json` export for it; `paper-camp dev`'s static file server is the only consumer.

Path aliases (`vite.config.ts`, `vite.app.config.ts`, `tsconfig.json`): `@` (→ `src/`) plus `@core`, `@cli`, `@app`, `@types`. App code imports through the `@/` alias (`@/app/stores/app-store`); `src/core`, `src/cli`, and the server modules stick to relative imports (`./parser`, `../types/index`) so the same code runs unchanged under `bun src/cli/index.ts` (the `cli` dev script) and the built `dist/cli/index.js`.

**`public/fonts/Luminari-Regular.woff`** is a vendored copy of `@dendelion/paper-ui`'s display font. Their compiled CSS references it via an absolute `url(/fonts/Luminari-Regular.woff)`, so any consuming app has to place that file at its own web root — paper-ui doesn't do this for you. Without it, the build silently falls back to the next font in the stack (Cormorant Garamond → Georgia → serif); the other fonts paper-ui's README mentions (Cormorant Garamond, Caveat, JetBrains Mono) aren't actually self-hosted via `@font-face` in the shipped CSS, just referenced by name, so no extra vendoring was needed for those.

**`src/app/styles/utilities.css`** carries `btn-green`/`btn-orange`/`btn-violet` classes that recolor `Button`'s fill to soft pastel washes with dark text, applied to the Open/Start/Stop/Mark-complete buttons. paper-ui's `Button` has no color prop — its fill is an SVG `<path>` layered behind the label, not a CSS `background` — so these classes target that path directly with `!important` (needed since paper-ui's own hover/active rules outrank a single external class in specificity). Note: paper-ui's own "blue" and "green" watercolor tokens are literally the same hex value upstream, so these three colors are custom hex values, not a reuse of paper-ui's tokens.

Stack:
- **UI**: `@dendelion/paper-ui` (paper/ink/canvas/watercolor design system — textures, warm color tokens, hand-drawn interaction details). The full source lives at `~/dev/paper-ui` (sibling repo), with a component showcase at `src/showcase/pages/components.tsx`. The dashboard currently uses: `Layout` (header/sidebar/automatic Page-wrap all off, `navigationIsland` taking arbitrary content rather than a dedicated nav component), `Island` (the floating chrome wrapping the nav content), `Page` (parchment texture wrapping the content outlet), `Card`, `Stamp`, `Alert`, `Accordion`, `Checkbox`, `Button`, `IconButton`, `Input`, `Select`, `Textarea`, `Modal`, `Progress`, `ListItem`, `Table` (both its plain `data`/`columns`/`expandable` mode for the phase list and its `board` mode for the kanban/ideas boards), `CodeBlock`, `Icon` plus the shipped icons (`CheckIcon`/`CloseIcon`/`CopyIcon`/`FolderIcon`/`LightbulbIcon`).
- **Routing**: `@tanstack/react-router`
- **State**: `zustand`
- **Validation**: `zod` — validates frontmatter and the parsed fields block per entry, kept external in the build (like `commander`/`zustand`) rather than bundled. Frontmatter parse/stringify goes through the `yaml` package.
- **Build/tooling**: Vite (lib build via `vite-plugin-dts` for `core`/`types`, app build via `@vitejs/plugin-react-swc`), TypeScript (strict), Biome (lint/format), Vitest.

---

## Dashboard

Two ways to run it, both serving the same app and the same `/api/*` shape against whatever directory you run them in:

- **`pnpm dev`** (this repo only) — Vite's dev server (`vite.app.config.ts`), with a `configureServer` plugin mounting `createApiMiddleware(process.cwd())`. Used while developing `src/app` itself, with HMR.
- **`paper-camp dev`** (installed package) — `src/cli/dev-server.ts`'s plain `node:http` server, serving the *built* `dist/app` plus the same API middleware. This is what an end user actually runs.

Four pages exist — Plans, Review, Docs, Settings (Focus was dropped; see decisions.md) — plus a persistent Stack panel present on all of them.

- **Plans** (`/`) — fetches `/api/plans`. Has two views, toggled by `ViewToggle` (state lives in `useAppStore`), plus an "Audit all" button (`POST /api/agent/launch-audit-all`) in the page header:
  - **List view** (default) — sections by status: "In progress" (`in-progress` + `review`), "Backlog" (`planned` + `idea`, with rank numbers), an "Ideas" two-column board (see below), and a collapsed-by-default "Closed" section (`done` + `dropped`). Each plan renders as a `PlanCard` — kraft-textured `Card` with a status accent, `PlanIdStamp` (`<KIND>-<N>`) next to the title, a `Stamp` for status, relative updated/created date, tags, and a `ProgressBar` computed from `### Phases` checkboxes. The whole card is clickable (no separate "Open" button); while a plan-draft agent runs, a `PlanCardSkeleton` placeholder holds its spot in Backlog.
  - **Board view** — paper-ui's `Table` in `board` mode, two columns ("Planned", "In Progress" — `idea` lives in the Ideas board instead, `done`/`dropped` in Closed), rendering `KanbanCard`s with `PlanIdStamp` + title + tags. Read-only — no drag-and-drop.
  - Clicking a plan card (either view) or a sidebar nav item shows `PlanDetail` — id/title header with a Start/Stop button (`PATCH /api/plans`; starting demotes any other in-progress plan), a status `Select`, relative date, tags, a "Copy Clarifications Prompt" `ClarifyButton`, body prose, any recorded Clarifications, a progress bar, an agent `Select` ("Project default agent" or a per-plan override), and the phase list as a `Table` with toggleable `Checkbox`es (`PATCH /api/plans`), a per-phase `PhaseCopyButton` and per-phase agent-launch button, and `expandable` rows showing each phase's optional `description`. The Phases header carries "Run all phases" (`launch-run-all`), "Audit phases against code" (`launch-audit`), and "Add as phases" (paste review findings) actions. Checking the last phase auto-moves an in-progress plan to `review`; a plan in `review` shows "Approve & close" / "Needs changes" buttons instead of Start/Stop. Below the phases, a Log section lists dated entries with a textarea to append new ones. This is the same view a plan opens into everywhere — there's no separate read-only or distraction-free variant anymore.
  - Malformed entries surface as a non-fatal `Alert`.
  - **Ideas vs. Backlog** are two distinct concepts, kept visually separate in both the sidebar and list view (see decisions.md):
    1. **Ideas** — `ideaEntries`, loaded via `readIdeasMerged` from `papercamp/ideas/*.md` per-file entries, each with a derived `status: 'planned' | 'done'` (done only once every plan whose `idea` field references it is `done`/`dropped`). Rendered as a two-column `IdeasBoard` (`Table` in `board` mode, "Planned"/"Done" columns; Done collapses past 4 entries behind an "N more ideas" link): each row shows a lightbulb/check `Icon`, the idea's short title, and — if any plan links to it via `idea` — an expand toggle listing every linked plan as a clickable `PlanIdStamp`; an unlinked idea gets a "Draft plan" button (`POST /api/agent/launch-draft`) instead. Created from the sidebar's "Ideas" "+" (`CreateIdeaModal` → `POST /api/ideas`); no delete. Clicking the title opens the idea's full body inline on the Plans page, with an "Extend with AI" button (`launch-extend`).
    2. **Backlog** — per-file plan entries with `status: idea` (from `papercamp/plans/*.md`), created via the sidebar's "Add to backlog" modal (`POST /api/plans`, with a `Kind` `Select`), fully CRUD (deletable via the sidebar's "×", editable like any other plan), and open into the same `PlanDetail` as a `planned`/`in-progress` plan.
    The sidebar shows "Ideas" only when `ideaEntries` is non-empty, and a separate "Backlog" section (with the add/delete actions) always; a branch-hygiene `Alert` (and a disabled add button) appears when the current branch is already merged into main. List view mirrors the Ideas/Backlog split.
- **Review** (`/review`) — the review queue: lists plans with `status: review` as `PlanCard`s (empty state: "No plans pending review."), opening into the same `PlanDetail` with its Approve & close / Needs changes actions. `ReviewSidebar` mirrors the pending list.
- **Docs** (`/docs`) — a documentation browser with a left `DocsSidebar` grouped into four sections: **Repo Docs** (`/api/docs` — `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE`, whichever exist), **Decisions** (`/api/decisions`, a `Stamp` for `decided`/`superseded`, a `superseded` entry links to its `Superseded-by` replacement), **Open Questions** (`/api/open-questions`, a `Stamp` for `open`/`resolved`, cross-linked to/from its `Resolved-by` decision, with a resolve form that writes the answering decision via `POST /api/open-questions/resolve`), and **Progress** (`/api/progress`, rendered as a reverse-chronological `ProgressTimeline`). Nothing is selected by default — the page shows "Select a section from the sidebar" until you pick an item. Each section shows "Loading…" while its slice of `useAppStore` is in flight, and an empty-state line once loaded with nothing. A search `Input` in the nav island (visible only on `/docs`) drives full-text search across all four sources, replacing the normal page body with `DocsSearch` results while a query is active.
- **Settings** (`/settings`) — sidebar-driven, mirroring the Docs/Plans sidebar shape. "General" (the default section) shows project info (`/api/config`: an editable `projectName` with its own Save button, a version `Stamp`, `initializedAt`, or a warning `Alert` if unconfigured), a "Project Icon" uploader (SVG/PNG/JPG/GIF/WebP via a hidden file input — paper-ui has no file-input component — previewed immediately and persisted through `POST /api/icon`), a `port` field (the default for `paper-camp dev`; does not affect the running server), and the per-task agent defaults — one agent/model/effort `Select` row each for Phase run / Plan draft / Idea extend / Commit suggest, saved via `POST /api/config`. An "Environment Variables" section reads and edits the repo-root `.env` (`GET`/`POST /api/env`), flagging referenced-but-missing variables. A "Config Files" section lists whichever allowlisted config file actually exists in the repo (`GET /api/configs`); selecting one fetches its content (`GET /api/configs?name=...`) and renders it read-only via `CodeBlock`. The uploaded icon (if any) replaces the default folder icon in the nav island and every sidebar header, next to the project name (read from this repo's own `package.json` `name` via `/api/package-name`, falling back to "Paper Camp").

**The Stack panel** (`src/app/components/stack-panel.tsx`) is not a route — it's a fixed, right-docked, full-height panel mounted once in `router.tsx` alongside `Outlet`, present on every page. Default open (state is a plain `useState`, so it resets on reload), collapsible to a small chalkboard "S" tab via an `IconButton`; slides via `framer-motion`. Chalkboard-textured, desk-green gradient background, Luminari header. Three sections in fixed 2/1/2 flex proportions:
- **Agent** — the current agent task from `/api/agent/status`: plan title + task kind (phase N / audit / batch audit / drafting / extending / suggesting commit message / syncing / run all) + agent label, a status `Stamp` (starting/running/stopping/done/error), a stop `IconButton` while running, and the streamed output lines in a scrolling mono block. "No agent running." when idle.
- **Status** — three clickable check `Stamp`s: **Quality** (lint+format) and **Tests** run their checks on click (`POST /api/status/check`); **Consistency** (backed by `/api/consistency`) expands its findings inline, each linking to the offending plan/decision/question. Below them, a two-line summary slot: failure summaries with a "run biome --write" fix action (`POST /api/status/fix`) or a copyable test-fix prompt, "All checks passing.", or "Checks haven't run yet."
- **Commit** — the current branch as a `Stamp`, the changed files from `/api/git/status` behind an `Accordion` of checkboxes, commit title/message inputs (pre-seeded from the focus plan via `findFocusPlan`, persisted to localStorage, or agent-suggested from the diff via the wand button → `/api/git/suggest-commit-message`), and a Commit button (`POST /api/git/commit`). With a clean tree it offers "Push N commits" when ahead, or "Sync to main" (`POST /api/git/sync`) otherwise.

The panel subscribes to `GET /api/activity/stream` (SSE) and treats every tick as a generic "something changed" signal, re-triggering the plans/status/consistency/git/agent loaders so the whole UI stays in sync without polling — there is no rendered activity feed.

Sidebar navigation lives in the nav island (a floating pill fixed near the bottom of the `Layout`, not a separate header) — `ProjectIdentityHeader`, an optional docs-search box, and ghost `Button`s for Plans/Review/Docs/Settings. A single persistent `SidebarShell` sits left of the content on every route, swapping its inner item list (`PlansSidebar`/`ReviewSidebar`/`DocsSidebar`/`SettingsSidebar`) per route rather than remounting the whole sidebar — this is what keeps route transitions from visibly jumping.

**Container depth:** `Layout` provides the full-page background with `showPage={false}` (we manually wrap `<Outlet />` in `<Page texture={{ texture: 'parchment' }}>` for the content area). Per-plan `Card`s, and the Stack panel's own `Card`s, are the only nesting inside that.

---

## Current implementation status

**Built and tested:**
- `src/types`, `src/core/schemas.ts` (+ the `frontmatter-schemas.ts` barrel), `src/core/parser.ts`, `src/core/readers.ts`, `src/core/idea-status.ts`, `src/core/env.ts`, `src/core/serializer.ts`, `src/core/scaffold.ts`, `src/core/templates.ts`, `src/core/index.ts`
- Claude Code native integration: skill (`.claude/skills/paper-camp/SKILL.md`), SessionStart focus hook, opt-in PostToolUse new-file logger — all scaffolded by `init`, see "Claude Code native integration" above
- `src/cli/index.ts` — `init`, `dev` (real, see below), `add plan`, `migrate`, `audit`
- `src/cli/dev-server.ts` — static + API server for installed consumers
- `vite.config.ts` cli build entry (with a `node:*`-matching external function, not a hardcoded list), so `pnpm build` produces a working `dist/cli/index.js` with shebang intact
- `src/app` — router, headerless/sidebarless `Layout` shell with a floating nav island and a persistent `SidebarShell`, four pages (Plans, Review, Docs, Settings) plus the always-present Stack panel, dev-time API middleware split into per-resource route modules
- Plans page: list/board view toggle, plan CRUD (create backlog item, delete, patch phases/status/log/agent), `PlanDetail` with interactive phase toggling (auto-review on last phase), per-phase copy-prompt and agent launch, run-all/audit/add-review-phases actions, clarifications, plan/idea IDs, collapsible Closed section, separate Ideas board and Backlog groupings, agent-drafted plans from ideas
- Review page: pending-review queue opening into the same `PlanDetail` approve/needs-changes flow
- Docs page: Repo Docs/Decisions/Open Questions/Progress sections, cross-linked decisions↔questions, resolve-question flow writing to decisions.md, full-text search
- Settings page: project icon upload/display (`/api/icon`), editable project name and port (`POST /api/config`), per-task agent/model/effort defaults, `.env` editor (`/api/env`), project name branding sourced from `package.json` (`/api/package-name`) shown in the nav island and every sidebar header, dynamic config-file viewer
- Stack panel: agent task status with stop control, quality/tests/consistency checks with fix actions, and the git commit/push/sync flow with agent-suggested commit messages, refreshed live off the SSE change stream, present on every page
- Agent integration: Claude Code and opencode adapters, branch-per-plan hooks with per-phase commits and audit stamping
- `vite.app.config.ts` builds the SPA to `dist/app`; `pnpm build` runs all three builds (`tsc`, core/cli lib build, app SPA build)
- `public/fonts/Luminari-Regular.woff` vendored so paper-ui's display font actually loads instead of silently falling back
- Vitest coverage for the parser/schema validation and frontmatter round-trip (`parser.test.ts`, `frontmatter.test.ts`, `readers.test.ts`) plus the app server's agent/git managers and prompt/check helpers (`agent.test.ts`, `git.test.ts`, `prompts.test.ts`, `review-findings.test.ts`, `check-summary.test.ts`)
- Manually smoke-tested: `init` (already-initialized guard, no-clobber), `add plan`, the full dashboard driven through a headless browser against both `pnpm dev` and the built package's `paper-camp dev` in a fresh temp project

**Known gaps:**
- Health/momentum gauges (no paper-ui component yet)
- No favicon (`index.html` references `/favicon.svg`, which doesn't exist — harmless 404, cosmetic only)
