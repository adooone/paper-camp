# Paper Camp — Technical Reference

The philosophy and intent live in [papercamp/ideas/](./ideas/). This document covers the concrete shape of the system: folders, files, commands, and stack.

---

## Unified entity storage architecture

Ideas and plans are no longer two file types. Every entity — an *idea* for its whole
life, with the plan as a `### Phases` section written into the same file once one gets
drafted — is one markdown file with YAML frontmatter, living under `papercamp/ideas/`.
There is no `idea:` backlink anymore because there is nothing to link: the idea *is* the
plan file, from creation to close. The files that are read as a log/reference
(`decisions.md`, `open-questions.md`, `progress.md`, `about.md`) stay monolithic — the
per-file argument doesn't apply to append-only or single-document files.

### Directory layout

```
papercamp/
├── about.md                    # technical reference — stays one file, prose
├── decisions.md                # decision log — stays one file, append-only
├── open-questions.md           # open questions — stays one file, append-only-ish
├── progress.md                 # changelog — stays one file, append-only timeline
├── config.json                 # machine config (nextId, defaultAgents, port, projectName)
├── assets/
│   └── icon.svg
└── ideas/
    ├── index.md                # generated — id/title/type/status/tags, never hand-edited
    ├── IDEA-43.md               # YAML frontmatter + markdown body (idea prose, Phases, Log)
    ├── IDEA-44.md
    └── archive/
        ├── IDEA-1.md            # moved here verbatim on done/dropped, no rewrite
        └── IDEA-2.md
```

`papercamp/plans/` no longer exists — it retired once `paper-camp migrate` folded every
legacy plan (including archived ones) into unified entities under `papercamp/ideas/`.

### Filename convention

**Id-only, uppercase**: `IDEA-43.md`, `IDEA-44.md`.

- One lifetime id per entity, minted once and never reassigned even when the entity
  grows from a bare idea into a full plan (`type` and `status` change; `id` doesn't).
- Stable across renames — if an entity's title changes the file path doesn't, so
  existing references (git history, agent tool calls, URL bookmarks, branch names)
  never break.
- Shorter than id+slug — easier for agents to reference in file tool calls.
- The generated index provides the id → title mapping for human readability.

### YAML frontmatter format

Each entity file starts with a `---`-delimited YAML frontmatter block containing all
structured metadata. The markdown body below frontmatter has an optional prose
rationale, then `### Clarifications`, `### Phases`, and `### Log` sections — the same
grammar plans have always used, now shared by every entity regardless of whether it has
grown phases yet. The frontmatter is parsed by a real YAML library (the `yaml` package)
and validated against one zod schema, `entityFrontmatterSchema` in `src/core/parse/schemas.ts`
(the single source of truth); the old `planFrontmatterSchema`/`ideaFrontmatterSchema`
still exist in the same file but are only reachable through `paper-camp migrate`, reading
a pre-migration two-file corpus.

Example entity file, idea-shaped (no phases yet), `papercamp/ideas/IDEA-44.md`:

```markdown
---
id: IDEA-44
title: Capture-time overlap check
status: idea
created: 2026-07-04
tags:
  - app
  - ideas
---

Prose rationale...

### Log
- 2026-07-04: Initial capture
```

Example entity file, plan-shaped (phases drafted), `papercamp/ideas/IDEA-43.md`:

```markdown
---
id: IDEA-43
title: Unify the ideas and plans worklist
type: feat
status: in-progress
created: 2026-07-04
updated: 2026-07-05
tags:
  - app
  - ideas
  - plans
  - core
---

Description and rationale...

### Phases
- [ ] Phase 1: Design per-file schema
- [x] Phase 2: Build frontmatter parser

### Log
- 2026-06-28: Initial design drafted
```

Example note (planless entity, manually closed), unchanged in spirit from before the
merge:

```markdown
---
id: IDEA-37
title: Usage pattern worth remembering
kind: note
status: open
created: 2026-06-20
---

Prose body...
```

(Key order and the block-style tag list match what `formatEntityFile` actually emits;
the parser accepts any valid YAML, so hand-written flow-style tags parse fine too. There
is no `## <id>: <title>` body heading anymore — title lives only in frontmatter; the old
`formatIdeaFile`, which did emit that heading, is migration-only now.)

#### Entity frontmatter JSON Schema (generated from zod)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id":            { "type": "string", "description": "Permanent lifetime entity ID, e.g. IDEA-45 — never changes" },
    "title":         { "type": "string", "description": "Human-readable entity name" },
    "type":          { "type": "string", "enum": ["feat","fix","chore","docs","refactor"], "description": "Matches Conventional Commits types; usually set once a plan is drafted" },
    "kind":          { "type": "string", "enum": ["note"], "description": "Marks an entity that never grows phases, with a manually-set open/done/dropped status" },
    "status":        { "type": "string", "enum": ["idea","planned","in-progress","review","done","dropped","open"], "description": "idea → planned → in-progress → review → done/dropped; notes use open → done/dropped" },
    "agent":         { "type": "string", "enum": ["claude-code","opencode"], "description": "Per-entity agent override" },
    "created":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Creation date (YYYY-MM-DD)" },
    "updated":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Last significant update date (YYYY-MM-DD)" },
    "audited":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Date of last successful convergence audit (YYYY-MM-DD)" },
    "audited-hash":  { "type": "string", "description": "Content hash at last successful audit" },
    "tags":          { "type": "array", "items": { "type": "string" }, "description": "Tagging categories" }
  },
  "required": ["id", "title", "status", "created"],
  "additionalProperties": false
}
```

Two `.refine()` checks enforce the note/status asymmetry: a `kind: 'note'` entity's
status must be one of `open|done|dropped`, and `status: 'open'` is only valid when
`kind === 'note'` — so a plan-bearing entity can never carry a stale hand-set status.

Source: `src/core/parse/schemas.ts` — `entityFrontmatterSchema` is the single source of truth;
the JSON Schema above is generated from it via zod v4's built-in `toJSONSchema()`.

### Index file

`papercamp/ideas/index.md` is generated on every write — never hand-edited
(`regenerateIndexes` in `src/app/server/helpers.ts` for the API, `formatEntitiesIndex`
in `src/core/serialize/serializer.ts` for the CLI paths). It provides a fast overview without
scanning every entity file:

```markdown
# Ideas

| Id | Title | Type | Status | Tags |
|---|---|---|---|---|
| IDEA-43 | Unify the ideas and plans worklist | feat | in-progress | app, ideas, plans, core |
| IDEA-44 | Capture-time overlap check | — | idea | app, ideas |
```

Rows are sorted by numeric id, ascending, covering both live and archived entities. The
`Type` column shows the entity's `type` if set, `note` for notes, or `—` for an
undrafted idea with no type yet — no bodies, no phases. This is what an agent's first
"what's going on here" pass actually reads (the dashboard's list view reads the parsed
entries from `/api/plans`/`/api/ideas` instead).

### Archive mechanism

An entity moving to `done` or `dropped` ends with a **file move** — `archiveEntityFile`
(`src/core/serialize/serializer.ts`) renames `papercamp/ideas/<ID>.md` to
`papercamp/ideas/archive/<ID>.md`; the move itself has no parse-and-re-serialize step.
One nuance: the dashboard's `PATCH /api/plans` first re-serializes the file to record the
new `status` and stamp `updated`, *then* moves it — so an entity closed through the UI is
rewritten by the serializer on its way to the archive (hand-written formatting the
serializer can't produce doesn't survive that path; only the move step is byte-for-byte).
`paper-camp migrate` writes already-done/dropped legacy entries directly into `archive/`.
Readers treat archived entities as first-class: `readEntities` scans both `ideas/` and
`ideas/archive/`.

Notes archive the same way as plan-bearing entities now — a `kind: note` entity that's
manually closed (`status: done`/`dropped`) moves to `archive/` just like any other, since
there's only one file shape and one archive path.

### Config migration

Config was previously stored in `.paper-camp/config.json` and assets in `.paper-camp/assets/`.
These have been moved into the visible `papercamp/` directory:

- `papercamp/config.json` — machine config (nextId, defaultAgents, port, projectName, initializedAt, version)
- `papercamp/assets/icon.*` — project icon files

This eliminates the confusion of having two top-level project directories with different
visibility conventions. The config schema (zod `paperCampConfigSchema` in
`src/core/parse/schemas.ts`) has grown `nextId` and `defaultAgents` (per-task agent/model/effort)
since. `nextId` is now a single live counter, `nextId.idea`, that every new entity mints
its lifetime `IDEA-N` id from (`assignEntityId`, delegating to `assignPlanId(configPath,
'idea')`); the old per-kind fields (`feat`, `fix`, `chore`, `docs`, `refactor`) remain in
pre-migration `config.json` files as inert leftovers — nothing reads or writes them
anymore. Known drift, noted rather than papered over: the dashboard writes an
optional `port` key (`POST /api/config`, present on the `PaperCampConfig` TS type) that
`paperCampConfigSchema` doesn't declare; the schema is only enforced by `init`, so
nothing currently catches the mismatch.

### Migration plan

See `papercamp/ideas/archive/FEAT-24.md` (the original per-file migration, itself
archived) and `papercamp/ideas/IDEA-43.md` (the single-file entity migration this section
now describes, also complete) for the phased history. The per-file migration's seven
phases landed first (design schema/layout, build parser/serializer, generate index
files, implement archive as file move, update CLI/API routes, move `.paper-camp/` config
into `papercamp/`, ship the one-time migration script), then IDEA-43 folded the two file
types into one: `entityFrontmatterSchema` replaced `planFrontmatterSchema`/
`ideaFrontmatterSchema` as the live schema, `parseEntityFile`/`formatEntityFile` replaced
the split parse/serialize pair, `readEntities` replaced `readPlansMerged`/
`readIdeasMerged`, and `paper-camp migrate` folded every legacy plan and idea file
(including archived ones) into unified entities under `papercamp/ideas/`.

This repo has been migrated: no `papercamp/plans/` directory remains, and no idea file
carries an `idea:` backlink anymore — every entity is one file. `parsePlanFile`/
`parseIdeaFile`/`formatPlanFile`/`formatIdeaFile` and the old frontmatter schemas still
exist in `src/core`, reachable only through `paper-camp migrate` for repos that haven't
converted yet.

---

## Two directories, two jobs

### `papercamp/` — the project's memory (versioned, human + AI readable)

Lives at the repo root. Plain markdown, committed alongside the code it describes.

| File | Purpose |
|------|---------|
| `ideas/` | Per-entity files with YAML frontmatter — one file per idea for its whole life, the plan living inside it as a `### Phases` section once drafted. |
| `progress.md` | Running log of what's done, in chronological order. |
| `decisions.md` | Choices made and the reasoning behind them — the record that prevents re-litigating settled questions. |
| `open-questions.md` | Unresolved items that need a decision before work can proceed. |

Every entity carries one permanent lifetime `IDEA-N` id, unchanged from creation through
close, and `ideas/` has a generated `index.md` — but the index is a disposable summary
rebuilt on every write, never a second source of truth. The log files stay id-free and
index-free. History is git's job, not a "Status: PENDING/IN_PROGRESS/COMPLETED" field
inside a document — lifecycle status lives in entity frontmatter and nowhere else.

---

## Storage decision: markdown, not a database

**Decision:** the `papercamp/` files are the single source of truth. No SQLite, no JSON store, no sync layer. The dashboard parses the markdown live, on every read.

**Why not a database:** the core promise is that any AI assistant — Claude Code, Cursor, whatever's open in the terminal — can read and edit project memory with zero setup, using its normal file tools. A database forces a custom MCP server or query tool into every AI session just to touch the data, and it kills meaningful git diffs (binary/opaque blobs vs. readable history). Markdown is the only format that's human-readable, AI-readable-with-no-tooling, and git-diffable at once — that's non-negotiable given the project's philosophy.

**Why not a cache either:** for a solo project's planning files (a handful of small `.md` files), parsing on every dashboard request is fast enough that an index/cache buys nothing but complexity. If that ever stops being true at scale, the fix is a disposable, gitignored index rebuilt from the files on change — never a second source of truth. Not needed for v1.

**How structure is added without losing the prose:** every entity uses per-file YAML frontmatter — the schema, required fields, and example files are covered in `## Unified entity storage architecture` above. The three remaining monolithic files (`decisions.md`, `open-questions.md`, `progress.md`) stay monolithic because they are append-only logs rather than entity collections: there is no per-entry archive move, ID-based lookup, or rename needed, so splitting each entry into its own file adds path-management overhead without enabling any new capability. Each record in those files uses a lightweight `## Heading` + `**Field:** value` block grammar instead:

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
  "nextId": { "idea": 55, "feat": 44, "fix": 3, "chore": 2, "docs": 4, "refactor": 5 },
  "defaultAgents": {
    "phase": { "agent": "claude-code", "model": "sonnet", "effort": "medium" },
    "planDraft": { "agent": "claude-code", "model": "fable", "effort": "high" },
    "ideaExtend": { "agent": "claude-code", "model": "opus", "effort": "high" },
    "commitSuggest": { "agent": "claude-code", "model": "sonnet", "effort": "low" }
  }
}
```

`nextId.idea` is the one live counter every new entity mints its lifetime `IDEA-N` id
from (`assignEntityId`, delegating to `assignPlanId(configPath, 'idea')`); the per-kind
fields (`feat`, `fix`, `chore`, `docs`, `refactor`) are inert leftovers from before the
entity migration — nothing reads or writes them anymore, they just haven't been deleted
from existing `config.json` files. `port` is optional (see the schema-drift note under
"Config migration" above). Legacy bare-string `defaultAgents` values
(`"phase": "opencode"`) are coerced to the object shape on read. An optional
`autoLogNewFiles: boolean` field gates the opt-in PostToolUse hook (see "Claude Code
native integration" above) — absent or `false` means off.

---

## CLI

Bin entry: `paper-camp` → `dist/cli/index.js`, built with `commander`. Implemented in `src/cli/index.ts`.

| Command | Effect |
|---------|--------|
| `paper-camp init [project-name] [-i, --intent <text>]` | Creates `papercamp/config.json`, `papercamp/ideas/` (with `index.md` and `archive/` subdir), and `papercamp/{progress,decisions,open-questions}.md`. `--intent` seeds `ideas/index.md` with the one-line description (note: the first index regeneration replaces that prose with the generated id/title/type/status table); everything else starts empty for the AI/human to fill in during the first session — the CLI does not call an LLM itself (see "Storage decision" below for why init stays this thin). Refuses to run if `papercamp/config.json` already exists, and never overwrites existing files. |
| `paper-camp dev [-p, --port <number>]` | Starts a plain `node:http` server (`src/cli/dev-server.ts`): `/api/*` via `createApiMiddleware`, everything else served statically from the built `dist/app`, falling back to `index.html` for unknown paths (SPA routing). Defaults to port 3333. Errors out with a pointer to `pnpm build` if `dist/app` is missing; kills any running agent task on SIGINT/SIGTERM. |
| `paper-camp add plan <name> [-k, --kind <kind>]` | Writes a new unified entity file at `papercamp/ideas/<ID>.md` via `formatEntityFile` (YAML frontmatter `id`, `title`, `type` — default `feat`, `status: idea`, `created`) and an empty body, minting the next lifetime `IDEA-N` id via `assignEntityId` (the single `nextId.idea` counter), then regenerates `ideas/index.md` via `formatEntitiesIndex`. The subcommand name (`add plan`) is legacy — every entity it creates lives idea-shaped until phases get drafted into it. |
| `paper-camp migrate` | One-time migration for repos still on the legacy two-file corpus: reads legacy ideas (`parseIdeaFile`) and plans (`parsePlanFile`, including `plans/archive/`), folds each 1:1 idea↔plan pair into one unified entity (idea keeps its id if any plan links to it), mints fresh `IDEA-N` ids for orphan plans and for the extra plans of an idea that spawned more than one, writes already-done/dropped entries straight to `ideas/archive/`, regenerates the index, and reminds you to delete `papercamp/plans/` afterward (it's no longer read once migrated). |
| `paper-camp audit` | Runs the convergence-audit agent over every non-note entity with `status: review`/`done`, skipping ones whose `audited` stamp is at least as new as the file's mtime; stamps `audited` on success and prints an audited/skipped/failed summary with any gap phases appended. |
| `paper-camp mcp` | Starts the MCP stdio server (`src/mcp/tools.ts`) exposing entity read/write tools to any MCP-capable client. |

---

## Claude Code native integration

Paper Camp plugs into Claude Code itself rather than only offering a dashboard: any
project with a `papercamp/` folder gets its memory loaded and kept current with zero
prompting. `paper-camp init` scaffolds three surfaces (see `scaffoldClaudeCodeIntegration`
in `src/core/scaffold/scaffold.ts`, static contents in `src/core/scaffold/templates.ts`), each following
init's existing no-clobber contract — an already-present file is left untouched.

1. **The skill** (`.claude/skills/paper-camp/SKILL.md`) — auto-discovered whenever the
   working directory contains `papercamp/`. Instructs the assistant to read `plans/`,
   `ideas/`, `decisions.md`, and `open-questions.md` before working, and to keep the
   active plan's phases and `progress.md` current as it goes (this repo's own copy at
   `.claude/skills/paper-camp/SKILL.md` is the source the template mirrors verbatim).
2. **The SessionStart hook** (`.claude/settings.json`) — shells out to
   `paper-camp session-focus` (`src/cli/session-focus.ts`, exporting `buildSessionFocus`)
   on every new session. It *derives* a focus block from live data rather than reading a
   hand-maintained file: the in-progress entity (preferring the one tied to the current
   feature branch via the git manager's `getFeatureBranchPlanId`, falling back to
   `findFocusPlan` over `readWorkEntries`) plus the last 3 `progress.md` bullets. Prints
   a `hookSpecificOutput.additionalContext` JSON payload for Claude Code to inject, or
   exits silently if no `papercamp/ideas/` directory exists.
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

- `src/types/index.ts` — shared types: `EntityEntry` (the unified storage type — `id`, `title`, optional `type`/`kind: 'note'`, `status`, `agent`, `created`/`updated`/`audited`/`auditedHash`, `tags`, `body`, `phases`, `log`/`clarifications`), `EntityType`/`EntityStatus` (aliases over `PlanKind`/`PlanStatus` plus the note-only `'open'` status), `PlanKind`/`PLAN_KINDS` (`feat | fix | chore | docs | refactor`, matching Conventional Commits' type strings), `PlanEntry`/`IdeaEntry` — now projections of `EntityEntry` (see `src/core/readers.ts` below), not the storage shape — `DecisionEntry`, `OpenQuestionEntry`, `ProgressEntry`, `PhaseItem` (`text`, optional `description` for the collapsible long form, optional `source: 'review'`), `PaperCampConfig` (`nextId: Partial<Record<PlanKind, number>> & { idea?: number }` — `idea` is the one live counter, the rest are pre-migration leftovers — plus optional `port`, `defaultAgents`), plus the agent/status/git vocabulary the app server shares with the UI: `AGENT_IDS`/`AgentConfig`/`DefaultAgentsMap`/`DEFAULT_AGENTS`/`TaskKind`/`AgentTaskState`, `CheckStatus`/`CheckResult`/`CheckName`, `GitStatusEntry`/`BranchHygieneStatus`, `ConsistencyIssue`, `EnvEntry`.
- `src/core/parse/schemas.ts` — all the zod schemas: the `**Field:**`-block schemas for the monolithic files (`planFieldsSchema` — legacy, `decisionFieldsSchema`, `openQuestionFieldsSchema`), `entityFrontmatterSchema` (the live per-file frontmatter schema — single source of truth for the unified format), the legacy `planFrontmatterSchema`/`ideaFrontmatterSchema` (kept only for `paper-camp migrate` reading a pre-migration two-file corpus), and `paperCampConfigSchema`/`agentConfigSchema` for `config.json`. `src/core/parse/frontmatter-schemas.ts` is a thin re-export barrel kept so older references to that path don't break.
- `src/core/parse/parser.ts` — pure string → data parsing, no filesystem access: `parseEntityFile` (parse a single YAML-frontmatter entity file, validate against `entityFrontmatterSchema`, collect warnings instead of throwing; bodies get their `### Phases`/`### Log`/`### Clarifications` sections extracted — a `kind: note` entity with a non-empty Phases section is flagged as a warning), `parseFrontmatter` (low-level YAML frontmatter reader). Legacy `parsePlanFile`/`parseIdeaFile` still exist, reachable only from `paper-camp migrate` reading a pre-migration corpus. Still-active monolithic parsers for non-migrated files: `parseDecisions`/`parseOpenQuestions`/`parseProgress`, backed by `parseRawEntries` (generic `## heading` + fields + body splitter). `findConsistencyIssues` cross-checks decisions/questions/plans.
- `src/core/readers.ts` — the filesystem layer on top of parser.ts, now a single reader over the unified directory: `readEntities(ideasDir)` scans `ideas/` and `ideas/archive/` (skipping `index.md`) through `parseEntityFile`. Two thin adapter views sit on top, kept only so the plan-shaped/idea-shaped UI and API surfaces don't need to change yet: `readWorkEntries` (filters `kind !== 'note'`, maps via `entityToPlan` to `PlanEntry[]` — what `/api/plans` serves) and `readNoteEntries` (filters `kind === 'note'`, maps via `entityToIdea` to `IdeaEntry[]` — what `/api/ideas` serves). `readPlansMerged`/`readIdeasMerged` and the old per-dir `readAllPlanFiles`/`readAllIdeaFiles` no longer exist.
- `src/core/env.ts` — `parseEnv`/serialize helpers for `.env` files (`KEY=value` lines, quoting rules), backing the Settings page's Environment Variables editor via `/api/env`.
- `src/core/serialize/serializer.ts` — per-file writers: `formatEntityFile` (produce a YAML-frontmatter + body file for the unified entity — used by `add plan`, `migrate`, `POST /api/plans`, `POST /api/ideas`, and every PATCH rewrite via the server's `entityFileInput`/`writeEntityFile` helpers); `formatEntitiesIndex` (rewrite `ideas/index.md` after any mutation); `archiveEntityFile` (rename an entity file into `ideas/archive/`); `assignEntityId` (mints the next lifetime `IDEA-N`, delegating to `assignPlanId(configPath, 'idea')` against the single `nextId.idea` counter — a freed ID must never be reassigned; calls are chained through a module-level promise so same-process callers can't mint duplicates, while cross-process races — CLI vs dev server — are an accepted gap); `serializeFrontmatter` (low-level YAML serializer). Legacy `formatPlanFile`/`formatIdeaFile` still exist for `paper-camp migrate`. Still-active monolithic writers: `formatDecisionEntry`/`formatOpenQuestionEntry`/`formatOpenQuestions`/`formatProgressEntry` plus `appendBlock` (used by the open-question resolve flow).
- `src/core/scaffold/scaffold.ts` — `initProject`, used by `init`; also `scaffoldClaudeCodeIntegration`, which writes the four Claude Code native-integration surfaces (see above) from the static templates in `src/core/scaffold/templates.ts`.
- `src/cli/session-focus.ts` / `post-tool-use-log.ts` — the bodies behind the `session-focus` and `post-tool-use-log` CLI subcommands the scaffolded hooks shell out to (see "Claude Code native integration" above).
- `src/core/index.ts` — public core API; re-exports `env`/`readers`/the `parse`/`git-pr`/`scaffold`/`serialize` domain subfolders (each with its own `index.ts` barrel) and the shared types (`frontmatter-schemas.ts` is imported by path, not via any barrel).
- `src/cli/index.ts` — the commander CLI.
- `src/cli/dev-server.ts` — `startDevServer({ root, port })`, the plain `node:http` server `paper-camp dev` runs: reuses `createApiMiddleware` for `/api/*`, serves the built `dist/app` statically otherwise, with an `index.html` SPA fallback.
- `src/mcp/tools.ts` — the MCP stdio server's tools, all routed through the same `src/core` serializers as the dashboard routes (never a raw file write) so id allocation, archive-on-done, and index regeneration behave identically. Read tools: `list_plans`/`get_plan` (over `readWorkEntries`), `list_open_questions`, `list_decisions`. Write tools, serialized through a module-level mutex so concurrent stdio calls can't race id-minting: `add_idea`, `draft_plan` (same as `add_idea` but sets `type`, and checks branch conflicts first), `update_phase` (toggle a phase by index, optionally update status, archive on done/dropped), `append_progress`, `resolve_open_question`.
- `src/app/server/api.ts` — `createApiMiddleware(root)`, a Connect-compatible `(req, res, next)` handler, parsed live from `root`'s `papercamp/`. Shared by both the Vite dev plugin (`pnpm dev`) and `dev-server.ts` (`paper-camp dev`). It wires up the server-side managers — `activity.ts` (fs-watch SSE), `git.ts` (working-tree/branch operations), `status.ts` (lint/format/test check runner), `agent.ts` + `agent-hooks.ts` (agent task orchestration: per-phase commits, audit stamping) — and dispatches to per-resource route modules under `src/app/server/routes/`. `/api/plans` and `/api/ideas` remain two separate routes rather than collapsing into one `/api/entities`, but both are just filtered views over the same `papercamp/ideas/` corpus:
  - `routes/reads.ts` (plain GETs): `/api/plans` (`readWorkEntries` — every non-note entity, `PlanEntry` shape), `/api/ideas` (`readNoteEntries` — every `kind: note` entity, `IdeaEntry` shape), `/api/progress`, `/api/decisions`, `/api/open-questions`, `/api/consistency` (`findConsistencyIssues`, built from `readWorkEntries`), `/api/config` (with legacy bare-string `defaultAgents` coerced to the object shape), `/api/package-name` (reads `root`'s own `package.json` `name`, used for nav/sidebar branding), `/api/docs` (whichever of `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE` exist at the repo root — backs the Docs page's "Repo Docs" section), `/api/configs` (allowlist scan: `biome.json`, `tsconfig.json`, `tailwind.config.ts`, `vite.config.ts`, `vite.app.config.ts`, `postcss.config.js`, `package.json`).
  - `routes/plans.ts` — `POST /api/plans` ("Quick plan": `{ title, content?, kind? }`, always `status: idea` with a `type`, id via `assignEntityId`, `formatEntityFile` into `papercamp/ideas/<ID>.md`, index regen; 409s on branch-hygiene conflicts). `PATCH /api/plans?title=...` (finds a non-note entity by title/id, updates `phases`/`status`/`log`/`agent`, stamps `updated`; setting `in-progress` demotes any other in-progress entity to `planned`; setting `done`/`dropped` re-checks branch conflicts, then archives via `archiveEntityFile`). `DELETE /api/plans?title=...` (finds a non-note entity, unlinks its file, regen indexes).
  - `routes/ideas.ts` — `POST /api/ideas` ("New idea": `{ title, content?, kind?: 'idea'|'note' }`; id via `assignEntityId`; a plain idea gets `status: 'idea'` with no type, a note gets `kind: 'note'`/`status: 'open'`; `formatEntityFile`, index regen).
  - `routes/icon.ts` — `GET /api/icon` (serves whichever `papercamp/assets/icon.{svg,png,jpg,jpeg,gif,webp}` exists, 404 if none); `POST /api/icon` (accepts `{ dataUri }`, writes `papercamp/assets/icon.<ext>`).
  - `routes/config.ts` — `POST /api/config` (update `port`/`projectName`/`defaultAgents` in `config.json`, migrating any legacy single `defaultAgent` key); `GET /api/configs?name=...` (one allowlisted file's content — backs Settings' "Config Files" section).
  - `routes/env.ts` — `GET`/`POST /api/env` (read/write the repo-root `.env` via `src/core/env.ts` — backs Settings' Environment Variables editor).
  - `routes/git.ts` — `GET /api/git/status` (changed files + branch + ahead count + `branchHygiene`); `POST /api/git/commit` (stage selected paths, commit title/message), `/api/git/push`, `/api/git/sync` (clean tree: inline checkout-main + fast-forward; dirty tree: launches an agent task), `/api/git/suggest-commit-message` (agent-written title/body from the actual diff).
  - `routes/status.ts` — `GET /api/status` (lint/format/test check results), `POST /api/status/check` (run one), `POST /api/status/fix` (biome --write), and `GET /api/activity/stream` — an SSE endpoint backed by `activity.ts`, which recursively watches `papercamp/` (per-file trees, archive, and the monolithic files alike) and pushes a debounced generic "changed" tick; the one consumer (the Stack panel) ignores the payload and refetches everything. It deliberately does not synthesize a human-readable activity feed anymore.
  - `routes/agent.ts` — `GET /api/agent/status` plus `POST /api/agent/launch` (one phase), `launch-audit`, `launch-reconcile` (rewrite stale plan prose, preview-gated), `launch-audit-all`, `launch-draft` (plan from idea), `launch-extend` (idea body), `launch-run-all` (all phases with per-phase commits), and `stop`.
  - `routes/docs.ts` — `POST /api/open-questions/resolve?title=...` (validates, appends the new decision to `decisions.md`, flips the question to `resolved` with `Resolved-by` — refuses to write while the file has parse warnings).
- `src/app/router.tsx` — code-based TanStack Router tree: one root route rendering paper-ui's `Layout` (header, sidebar, and automatic page-wrap all off; a `navigationIsland` slot holding `ProjectIdentityHeader`, a docs-search `Input` shown only on `/docs`, and ghost `Button`s for the four nav items) + a manually-wrapped `Page` around `Outlet`, plus a persistent `StackPanel` (whose open state pads the content column by `layoutConfig.stackPanelWidth`). Four child routes: Plans (`/`), Review (`/review`), Docs (`/docs`), Settings (`/settings`). Each route's sidebar slot renders `PlanFilterColumn` + `PlanActionsColumn` (Plans), `ReviewSidebar` + `PlanActionsColumn` (Review), or the Docs/Settings sidebars — `PlanActionsColumn` swaps in for the filters while an entity is open.
- `src/app/features/{plans,docs,settings}/` — the page components; the Review page lives in `features/plans/review-page.tsx` since it renders the same `EntityDetail` piece as the Plans page.
- `src/app/hooks/` — `useProjectIdentity()` (the project's icon data URI, name, and a `loading` flag from `/api/icon`/`/api/package-name`; consolidates what was previously five independent copies of the same fetch logic) and `useActionFeedback()` (idle/loading/success/error state machine for one-shot action buttons like Draft plan / Extend with AI).
- `src/app/services/` — one module per API resource (`plans-api.ts`, `ideas-api.ts`, `docs-api.ts`, `config-api.ts`, `config-files-api.ts`, `icon-api.ts`, `package-api.ts`, `git-api.ts`, `status-api.ts`, `agent-api.ts`, `env-api.ts`), each a thin typed wrapper around `fetch` for its `/api/*` route. Feature components call these instead of fetching inline.
- `src/app/stores/app-store.ts` — a `zustand` store (`useAppStore`) holding: `plans` (via `/api/plans`, `PlanEntry[]` — every non-note entity); `ideaEntries` (via `/api/ideas`, `IdeaEntry[]` — now only `kind: note` entities; `deriveIdeaStatuses` has been retired and is no longer called anywhere in `src`); two parallel active-selection titles, `activePlanTitle`/`activeIdeaTitle` (there's no single unified "active entity" yet — the page picks `EntityDetail` vs `NoteDetail` based on which lookup resolves); the Plans page's `view: 'list' | 'board'` toggle and `planFilters` (including note-only `noteStatuses`); `decisions`/`openQuestions`/`progress`/`repoDocs` plus their own loading flags and `load*` actions; the Docs page's `activeDocSection`/`activeDocTitle`/`docSearchQuery`; Settings' `activeSettingsSection` (`general`/`env`/`config:<file>`) and `settingsConfigFiles`; the check-status slice (`status`, `runCheck`, `fixQuality`) and `consistency` findings; the git slice (`gitStatus`/`gitBranch`/`gitAhead`/`gitBranchHygiene`); and the agent slice (`agentStatus` plus the `launch*`/`stopAgent` actions). Plans and ideas are loaded once from `router.tsx`'s root route on mount; the Docs/Settings slices are loaded by their respective sidebars; the Stack panel loads and live-refreshes the status/git/agent slices off the SSE stream.
- `src/app/main.tsx` — mounts `RouterProvider` into `#root`, imports `@dendelion/paper-ui/dist/index.css`.
- `src/app/styles/tokens.ts` — the project's design tokens (`fontFamily`, `fontSize`, `lineHeight`, `space`, `color`, `layout`), either mirroring or consuming paper-ui's own `_tokens.scss` scale, used in place of hand-typed literals throughout `src/app`.
- `src/app/components/page-title.tsx` — a real big page-title heading. paper-ui's compiled CSS resets `h1`–`h6` to `font-size: inherit; font-weight: inherit` (Tailwind preflight), so a plain `<h1>` renders at body-text size — this is the deliberate override (Luminari, 2.5rem, 600 weight), shared by all four pages.
- `src/app/components/add-idea-modal.tsx` — a paper-ui `Modal` titled "Quick plan" with title/kind/description fields (kind via a `Select` over `PLAN_KINDS`), wired from the Plans page header's `AddToBacklogButton`. Submits via `POST /api/plans`. Its sibling `features/plans/components/create-idea-modal.tsx` (`CreateIdeaModal`, titled "New idea") has title/description plus a "Note — never needs a plan" `Switch`, wired from `NewIdeaButton`, and submits via `POST /api/ideas` (the Switch decides plain idea vs. `kind: note`). Both buttons render together in `PlansHeader`, not a sidebar "+".
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

- **Plans** (`/`) — fetches `/api/plans` (every non-note entity) and `/api/ideas` (notes only). Has two views, toggled by `ViewToggle` (state lives in `useAppStore`), plus a header toolbar (`PlansHeader`) with `NewIdeaButton` ("New idea", `CreateIdeaModal` → `POST /api/ideas`) and `AddToBacklogButton` ("Quick plan", `AddIdeaModal` → `POST /api/plans`), and an "Audit all" button (`POST /api/agent/launch-audit-all`).
  - **List view** (default) — one flat, status-sorted worklist (`selectWorklistRows` → `ListView`/`WorklistRows`, in-progress → review → planned → idea → done → dropped), not split into separate Ideas/Backlog sections. Each work entity renders as a `PlanRows` row via `PlanCard` — kraft-textured `Card` with a status accent, `PlanIdStamp` (`IDEA-N`) next to the title, a `Stamp` for status, relative updated/created date, tags, and a `ProgressBar` computed from `### Phases` checkboxes (an undrafted idea has none yet). Notes render as a distinct `NoteRowCard` with their own icon (`NoteIcon`) and status stamp. The whole card is clickable (no separate "Open" button); while a plan-draft agent runs, a `PlanCardSkeleton` placeholder holds its spot.
  - **Board view** — paper-ui's `Table` in `board` mode, two columns ("Planned", "In Progress" only — notes and undrafted ideas don't appear here), rendering `KanbanCard`s with `PlanIdStamp` + title + tags. Read-only — no drag-and-drop.
  - Clicking a work-entity card or sidebar item shows `EntityDetail` (`src/app/features/plans/components/entity-detail.tsx`) — the one detail view for a work entity, idea-shaped until it has phases and plan-shaped after (`hasPhases = plan.phases.length > 0`). Idea-shaped: id/title header, body prose, a "Draft plan" button and an "Extend with AI" button, no phases table yet. Plan-shaped: adds the phase list as a `Table` with toggleable `Checkbox`es (`PATCH /api/plans`), a per-phase `PhaseCopyButton` and per-phase agent-launch button, `expandable` rows showing each phase's optional `description`, and the Phases header's "Run all phases"/"Audit phases against code"/"Add as phases" actions. Checking the last phase auto-moves an in-progress entity to `review`. Start/Stop, the status `Select`, the agent `Select`, and the review Approve-&-close/Needs-changes buttons live in the sidebar's `PlanActionsColumn` instead of the detail view itself (see below), which swaps in for the filters column while an entity is open. Below the phases, a Log section lists dated entries with a textarea to append new ones.
  - A `kind: note` entity instead opens `NoteDetail` (`note-detail.tsx`) — markdown body, an "Extend with AI" button (no Draft-plan, since notes never grow phases), and its own manually-set open/done/dropped status stamp.
  - Malformed entries surface as a non-fatal `Alert`.
  - Sidebar: `PlanFilterColumn` shows the status/note filter chips (including a note filter chip) when nothing is open; `PlanActionsColumn` shows the working-branch indicator (an amber alert when a planned/in-progress/review entity is open on a branch that isn't its own, with a manual "Create branch" button — `POST /api/git/branch`) plus the lifecycle controls (Start/Stop, status `Select`, agent `Select`, review actions) when an entity is open. A branch-hygiene `Alert` (and a disabled add button) appears when the current branch is already merged into main.
- **Review** (`/review`) — the review queue: lists entities with `status: review` as `PlanCard`s (empty state: "No plans pending review."), opening into the same `EntityDetail` with its Approve & close / Needs changes actions surfaced through `PlanActionsColumn`. `ReviewSidebar` mirrors the pending list, with `PlanActionsColumn` beneath it.
- **Docs** (`/docs`) — a documentation browser with a left `DocsSidebar` grouped into four sections: **Repo Docs** (`/api/docs` — `MAIN.md`/`README.md`/`CHANGELOG.md`/`LICENSE`, whichever exist), **Decisions** (`/api/decisions`, a `Stamp` for `decided`/`superseded`, a `superseded` entry links to its `Superseded-by` replacement), **Open Questions** (`/api/open-questions`, a `Stamp` for `open`/`resolved`, cross-linked to/from its `Resolved-by` decision, with a resolve form that writes the answering decision via `POST /api/open-questions/resolve`), and **Progress** (`/api/progress`, rendered as a reverse-chronological `ProgressTimeline`). Nothing is selected by default — the page shows "Select a section from the sidebar" until you pick an item. Each section shows "Loading…" while its slice of `useAppStore` is in flight, and an empty-state line once loaded with nothing. A search `Input` in the nav island (visible only on `/docs`) drives full-text search across all four sources, replacing the normal page body with `DocsSearch` results while a query is active.
- **Settings** (`/settings`) — sidebar-driven, mirroring the Docs/Plans sidebar shape. "General" (the default section) shows project info (`/api/config`: an editable `projectName` with its own Save button, a version `Stamp`, `initializedAt`, or a warning `Alert` if unconfigured), a "Project Icon" uploader (SVG/PNG/JPG/GIF/WebP via a hidden file input — paper-ui has no file-input component — previewed immediately and persisted through `POST /api/icon`), a `port` field (the default for `paper-camp dev`; does not affect the running server), and the per-task agent defaults — one agent/model/effort `Select` row each for Phase run / Plan draft / Idea extend / Commit suggest, saved via `POST /api/config`. An "Environment Variables" section reads and edits the repo-root `.env` (`GET`/`POST /api/env`), flagging referenced-but-missing variables. A "Config Files" section lists whichever allowlisted config file actually exists in the repo (`GET /api/configs`); selecting one fetches its content (`GET /api/configs?name=...`) and renders it read-only via `CodeBlock`. The uploaded icon (if any) replaces the default folder icon in the nav island and every sidebar header, next to the project name (read from this repo's own `package.json` `name` via `/api/package-name`, falling back to "Paper Camp").

**The Stack panel** (`src/app/components/stack-panel.tsx`) is not a route — it's a fixed, right-docked, full-height panel mounted once in `router.tsx` alongside `Outlet`, present on every page. Default open (state is a plain `useState`, so it resets on reload), collapsible to a small chalkboard "S" tab via an `IconButton`; slides via `framer-motion`. Chalkboard-textured, desk-green gradient background, Luminari header. Three sections in fixed 2/1/2 flex proportions:
- **Agent** — the current agent task from `/api/agent/status`: plan title + task kind (phase N / audit / batch audit / drafting / extending / suggesting commit message / syncing / run all) + agent label, a status `Stamp` (starting/running/stopping/done/error), a stop `IconButton` while running, and the streamed output lines in a scrolling mono block. "No agent running." when idle.
- **Status** — three clickable check `Stamp`s: **Quality** (lint+format) and **Tests** run their checks on click (`POST /api/status/check`); **Consistency** (backed by `/api/consistency`) expands its findings inline, each linking to the offending plan/decision/question. Below them, a two-line summary slot: failure summaries with a "run biome --write" fix action (`POST /api/status/fix`) or a copyable test-fix prompt, "All checks passing.", or "Checks haven't run yet."
- **Commit** — the current branch as a `Stamp`, the changed files from `/api/git/status` behind an `Accordion` of checkboxes, commit title/message inputs (pre-seeded from the focus plan via `findFocusPlan`, persisted to localStorage, or agent-suggested from the diff via the wand button → `/api/git/suggest-commit-message`), and a Commit button (`POST /api/git/commit`). With a clean tree it offers "Push N commits" when ahead, or "Sync to main" (`POST /api/git/sync`) otherwise.

The panel subscribes to `GET /api/activity/stream` (SSE) and treats every tick as a generic "something changed" signal, re-triggering the plans/status/consistency/git/agent loaders so the whole UI stays in sync without polling — there is no rendered activity feed.

Sidebar navigation lives in the nav island (a floating pill fixed near the bottom of the `Layout`, not a separate header) — `ProjectIdentityHeader`, an optional docs-search box, and ghost `Button`s for Plans/Review/Docs/Settings. A single persistent `SidebarShell` sits left of the content on every route, swapping its inner item list per route rather than remounting the whole sidebar — this is what keeps route transitions from visibly jumping. On Plans/Review that inner slot holds `PlanFilterColumn`/`ReviewSidebar` plus `PlanActionsColumn` (see above); Docs/Settings keep their own `DocsSidebar`/`SettingsSidebar`.

**Container depth:** `Layout` provides the full-page background with `showPage={false}` (we manually wrap `<Outlet />` in `<Page texture={{ texture: 'parchment' }}>` for the content area). Per-plan `Card`s, and the Stack panel's own `Card`s, are the only nesting inside that.

---

## Current implementation status

**Built and tested:**
- `src/types`, `src/core/parse/schemas.ts` (+ the `frontmatter-schemas.ts` barrel), `src/core/parse/parser.ts`, `src/core/readers.ts`, `src/core/env.ts`, `src/core/serialize/serializer.ts`, `src/core/scaffold/scaffold.ts`, `src/core/scaffold/templates.ts`, `src/core/index.ts`
- Claude Code native integration: skill (`.claude/skills/paper-camp/SKILL.md`), SessionStart focus hook, opt-in PostToolUse new-file logger — all scaffolded by `init`, see "Claude Code native integration" above
- `src/cli/index.ts` — `init`, `dev` (real, see below), `add plan`, `migrate`, `audit`, `mcp`
- `src/cli/dev-server.ts` — static + API server for installed consumers
- `vite.config.ts` cli build entry (with a `node:*`-matching external function, not a hardcoded list), so `pnpm build` produces a working `dist/cli/index.js` with shebang intact
- `src/app` — router, headerless/sidebarless `Layout` shell with a floating nav island and a persistent `SidebarShell`, four pages (Plans, Review, Docs, Settings) plus the always-present Stack panel, dev-time API middleware split into per-resource route modules
- Plans page: list/board view toggle, entity CRUD (create idea/quick-plan, delete, patch phases/status/log/agent), one flat status-sorted worklist (no more separate Ideas/Backlog split), `EntityDetail` rendering idea-shaped or plan-shaped off whether phases exist yet, `NoteDetail` for `kind: note` entities, lifecycle controls in the sidebar's `PlanActionsColumn`, working-branch mismatch indicator with manual "Create branch", per-phase copy-prompt and agent launch, run-all/audit/add-review-phases actions, clarifications, lifetime `IDEA-N` ids, agent-drafted plans from ideas
- Review page: pending-review queue opening into the same `EntityDetail` approve/needs-changes flow
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
