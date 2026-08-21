# Paper Camp — Technical Reference

The philosophy and intent live in [papercamp/ideas/](./ideas/). This document covers the
concrete shape of the corpus: the file format, the grammar of each section, the CLI, and
how Paper Camp installs itself into a repository.

It deliberately does **not** inventory the source tree. `AGENTS.md`'s codebase map does
that and is kept current with the code; a second copy here is what rotted last time.

---

## Unified entity storage architecture

Ideas and plans are not two file types. Every entity — an *idea* for its whole life, with
the plan as a `### Phases` section written into the same file once one gets drafted — is
one markdown file with YAML frontmatter under `papercamp/ideas/`. There is no `idea:`
backlink for a normal entity because there is nothing to link: the idea *is* the plan
file, from creation to close. (`kind: fix` entities are the one exception; they carry an
`idea:` link to the parent they follow up on.)

Decisions and open questions are not files either. They are thread messages on the entity
they bind — see "Thread grammar" below.

### Directory layout

```
papercamp/
├── about.md                    # this file
├── config.json                 # machine config (corpus version, nextId, defaultAgents, desk)
├── suggestions.md              # the AI idea inbox
├── run-order.md                # in-flight entity ids, one per line (gitignored)
├── assets/
│   └── icon.png
└── ideas/
    ├── IDEA-43.md              # YAML frontmatter + body (prose, Phases, Fixes, Thread)
    ├── IDEA-44.md
    └── archive/
        ├── IDEA-1.md           # moved here on close, no rewrite
        └── IDEA-2.md
```

There is no generated index file. Every reader parses the directory directly
(`readEntities` scans `ideas/` and `ideas/archive/`), which is cheap at this scale and
removes a second source of truth that could disagree with the files.

`papercamp/plans/` no longer exists — it retired once `paper-camp migrate` folded every
legacy plan into unified entities.

### Filename convention

**Id-only, uppercase**: `IDEA-43.md`, `IDEA-44.md`.

- One lifetime id per entity, minted once and never reassigned even when the entity grows
  from a bare idea into a full plan (`type` and `status` change; `id` doesn't).
- Stable across renames — if an entity's title changes the file path doesn't, so existing
  references (git history, agent tool calls, URL bookmarks, branch names) never break.
- Shorter than id+slug — easier for agents to reference in file tool calls.

### Title style

A `title` is a noun/verb phrase, at most 40 characters, roughly 3–6 words. No em-dash
subtitles, no trailing clause — the symptom, mechanism, and detail belong in the body's
first paragraph. One style for every type; a fix is not licensed to be a sentence ("Desk
is broken under the mount — router basepath, API base, and a friendlier route" → "Desk
breaks under the mount"). Every author that mints a title — the New idea capture,
suggest-ideas, the draft prompt, desk capture, and any hand-written entity — follows the
same rule, and `branchName()` caps the kebab slug at 40 characters so legacy long titles
still produce sane branches. AGENTS.md carries the same rule beside the branch scheme it
protects.

### YAML frontmatter format

Each entity file starts with a `---`-delimited YAML frontmatter block holding all
structured metadata. The body below it is optional prose, then any of `### Phases`,
`### Fixes`, and `### Thread`. Frontmatter is parsed by the `yaml` package and validated
against one zod schema, `entityFrontmatterSchema` in `src/core/parse/schemas.ts` — the
single source of truth. The legacy `planFrontmatterSchema`/`ideaFrontmatterSchema` still
exist in the same file but are reachable only through `paper-camp migrate`.

Example entity, idea-shaped (no phases yet):

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

### Thread
- [ ] 2026-07-04 [note] Worth checking against the existing corpus first.
```

Example entity, plan-shaped:

```markdown
---
id: IDEA-43
title: Unify the ideas and plans worklist
type: feat
status: in-progress
created: 2026-07-04
updated: 2026-07-05
subject: Planning surface
tags:
  - app
  - core
---

Description and rationale...

### Phases
- [ ] Design per-file schema
- [x] Build frontmatter parser
      run: 6m40s · 1.2M in · 38k out · fable-5
```

A completed phase (or fix) may carry a `run:` annotation as an indented sub-line alongside
any description: `run: <time> · <in> · <out> · <model>`, with a trailing `· ×N` when it ran
more than once. Run-all writes it when a phase lands and keeps it cumulative across
attempts; the precise figures live in `tasks.log`, so this line is a compact human
annotation, not the source of truth.

A note (an entity that never grows phases):

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

Key order and the block-style tag list match what `formatEntityFile` emits; the parser
accepts any valid YAML, so hand-written flow-style tags parse fine. There is no
`## <id>: <title>` body heading — the title lives only in frontmatter.

#### Entity frontmatter JSON Schema (generated from zod)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "id":            { "type": "string", "description": "Permanent lifetime entity ID, e.g. IDEA-45 — never changes" },
    "title":         { "type": "string", "description": "Human-readable entity name" },
    "type":          { "type": "string", "enum": ["feat","fix","chore","docs","refactor"], "description": "Conventional Commits value driving commit types and branch prefixes; usually set once a plan is drafted" },
    "kind":          { "type": "string", "enum": ["note","fix"], "description": "\"note\" never grows phases; \"fix\" is a follow-up linked to a done/archived parent via `idea`; omitted for normal ideas" },
    "status":        { "type": "string", "enum": ["idea","planned","in-progress","review","done","dropped","open"], "description": "Stored override, not the source of truth — most states derive from phases/branch/PR" },
    "agent":         { "type": "string", "enum": ["claude-code","opencode"], "description": "Per-entity agent override" },
    "created":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Creation date (YYYY-MM-DD)" },
    "updated":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Last significant update date (YYYY-MM-DD)" },
    "audited":       { "type": "string", "pattern": "^\\\\d{4}-\\\\d{2}-\\\\d{2}$", "description": "Date of last successful convergence audit (YYYY-MM-DD)" },
    "audited-hash":  { "type": "string", "description": "Content hash at last successful audit" },
    "released":      { "type": "string", "description": "Version tag (e.g. v0.13.1) that first shipped this idea" },
    "tags":          { "type": "array", "items": { "type": "string" }, "description": "Tagging categories" },
    "idea":          { "type": "string", "description": "IDEA-N backlink to the parent a fix addresses; required when kind: fix" },
    "subject":       { "type": "string", "description": "Subject group name; absent renders as the virtual \"No subject\" group" },
    "order":         { "type": "number", "description": "Run order; absent sorts after ordered entries" },
    "issueSource":   { "type": "string", "description": "sourceKind:sourceKey of the Issue this entity was promoted from, if any" }
  },
  "required": ["id", "title", "created"]
}
```

**Unknown keys pass through, deliberately.** The schema is a zod `.passthrough()`, and the
serializer re-emits any key it didn't recognise. A paper-camp that doesn't understand a
field must carry it, not drop it — see "Corpus format version" below.

Three `.refine()` checks enforce the shape rules: a `kind: note` entity's status must be
`open`/`done`/`dropped`; `status: open` is valid only when `kind` is `note`; and a
`kind: fix` entity must carry an `idea:` link to its parent.

Source: `src/core/parse/schemas.ts`. The JSON Schema above is generated from the zod
schema via `toJSONSchema()`.

### Thread grammar

`### Thread` is where a decision, a question, a log line, or a review verdict lives — on
the entity it concerns, rather than in a separate corpus-wide file. One message per line:

```markdown
### Thread
- [x] 2026-08-20 [decision] No issues store. Issues stay entirely derived.
- [ ] 2026-08-19 [question] One runtime per repo, or one managing many?
- [x] 2026-08-18 [log] [agent] Re-scoped: the paper-ui work moved out of this plan.
```

- The checkbox carries **state** for `note`, `decision` and `question` kinds — unchecked
  is `open`, checked is `resolved`. Other kinds ignore it.
- Kinds are `log`, `clarification`, `review`, `note`, `decision`, `question`, `chat`.
- An optional `[agent]` marker after the kind records that an agent wrote it.
- A message is **one line**. The serializer always writes it that way, so a hand-wrapped
  message is re-canonicalised on the next write.

`### Fixes` uses the same checkbox grammar as `### Phases` and holds follow-up work
attached to an entity rather than spawned as its own `kind: fix` file.

### Archive mechanism

Closing an entity ends with a **file move** — `archiveEntityFile`
(`src/core/serialize/serializer.ts`) renames `papercamp/ideas/<ID>.md` to
`papercamp/ideas/archive/<ID>.md`, with no parse-and-re-serialize step.

The move is automatic only for `dropped`: `PATCH /api/plans` and the MCP `update_phase`
tool archive on that status alone, and the MCP `archive_entity` tool does it on demand. A
`done` entity is *expected* to live in `archive/` but is not moved there automatically —
`paper-camp doctor` reports the mismatch under its `archive-placement` rule and
`doctor --fix` performs the move. This is why closing an idea usually produces a separate
"Archive IDEA-N" commit.

One nuance on the API path: `PATCH /api/plans` re-serializes the file to record the new
status and stamp `updated` *before* moving it, so an entity closed through the UI is
rewritten by the serializer on its way to the archive. Only the move step is byte-for-byte.

Readers treat archived entities as first-class: `readEntities` scans both directories.
Notes archive exactly like plan-bearing entities — one file shape, one archive path.

### Corpus format version

`config.json`'s `version` is a **number** declaring the format the corpus was written in
(`CORPUS_FORMAT_VERSION` in `src/core/corpus-format.ts`), not the package version. It
changes only when the frontmatter or config shape changes.

- A corpus **older** than the running paper-camp, or one with no version stamped, reads
  and writes normally.
- A corpus **newer** than the running paper-camp stays readable, but writes are refused
  (`CorpusTooNewError` via `assertCorpusWritable`) rather than performed lossily.
- Migrating up is an explicit, reviewable action — `paper-camp doctor --bump-format`
  stamps the new version and produces a git diff, never an implicit rewrite on load.

Together with the frontmatter passthrough above, this is what lets two paper-camp versions
share one repository without silently destroying each other's fields.

### `papercamp/config.json`

Machine state, not project narrative. Editable from the dashboard's Settings page.

```json
{
  "version": 1,
  "projectName": "paper-camp",
  "initializedAt": "2026-04-29T00:00:00.000Z",
  "nextId": { "idea": 196 },
  "defaultAgents": {
    "phase": { "agent": "claude-code", "model": "sonnet", "effort": "medium" },
    "planDraft": { "agent": "claude-code", "model": "opus", "effort": "high" }
  },
  "subjects": ["Planning surface", "App UI", "Code health"],
  "desk": {
    "services": [{ "name": "app", "cmd": "pnpm dev", "port": 3333 }],
    "checks": [{ "name": "lint", "cmd": "pnpm lint" }],
    "ci": { "repo": "adooone/paper-camp", "branch": "main" }
  }
}
```

`nextId.idea` is the one live counter every new entity mints its lifetime `IDEA-N` id from
(`assignEntityId`, delegating to `assignPlanId(configPath, 'idea')`). The per-kind fields
(`feat`, `fix`, `chore`, `docs`, `refactor`) are inert leftovers from before the entity
migration — nothing reads or writes them. Legacy bare-string `defaultAgents` values
(`"phase": "opencode"`) are coerced to the object shape on read.

Known drift, noted rather than papered over: `paperCampConfigSchema` declares `version`,
`projectName`, `initializedAt`, `nextId`, `defaultAgent`, `defaultAgents` and `desk`, while
the `PaperCampConfig` TypeScript type also carries `port`, `subjects`, `setupDismissed`,
`integration` and `commands`. The schema is only enforced by `init`, so nothing catches the
mismatch on an existing project.

### Migration history

`paper-camp migrate` exists for repos still on the legacy two-file corpus: it reads legacy
ideas and plans (including `plans/archive/`), folds each 1:1 idea↔plan pair into one
entity, mints fresh ids for orphan plans, and writes already-closed entries straight to
`ideas/archive/`. This repo has been migrated — no `papercamp/plans/` remains.
`parsePlanFile`/`parseIdeaFile`/`formatPlanFile`/`formatIdeaFile` and the old frontmatter
schemas survive in `src/core` solely to serve that command.

---

## Storage decision: markdown, not a database

**Decision:** the `papercamp/` files are the single source of truth. No SQLite, no JSON
store, no sync layer. The dashboard parses the markdown live, on every read.

**Why not a database:** the core promise is that any AI assistant — Claude Code, Cursor,
whatever's open in the terminal — can read and edit project memory with zero setup, using
its normal file tools. A database forces a custom MCP server or query tool into every AI
session just to touch the data, and it kills meaningful git diffs (binary/opaque blobs vs.
readable history). Markdown is the only format that's human-readable, AI-readable with no
tooling, and git-diffable at once.

**Why not a cache either:** for a handful of small `.md` files, parsing on every request is
fast enough that an index buys nothing but complexity. If that stops being true, the fix is
a disposable, gitignored index rebuilt from the files on change — never a second source of
truth. The generated `ideas/index.md` that earlier versions wrote was removed for exactly
this reason.

**Why one file per entity, and none for the rest:** an entity needs per-entry archive
moves, id-based lookup, and renames, which is what a file gives it. The remaining corpus
files (`suggestions.md`, `run-order.md`) are flat lists with none of those needs, so they
stay single files. Decisions and open questions started as monolithic files and became
thread messages instead — binding them to the entity they concern removed the
cross-reference bookkeeping that made them drift.

**History is git's job**, not a `Status: PENDING/IN_PROGRESS/COMPLETED` field inside a
document. Lifecycle status derives from phases, branch and PR state, with frontmatter
holding only an override.

---

## CLI

Bin entry: `paper-camp` → `dist/cli/index.js`, built with `commander`. Implemented in
`src/cli/index.ts`.

| Command | Effect |
|---------|--------|
| `paper-camp init [project-name]` | Creates `papercamp/` with `config.json` (stamped at the current corpus format version), `ideas/` and `ideas/archive/`, an example `IDEA-1.md`, and an empty `suggestions.md`. Also scaffolds the Claude Code integration below. Refuses to run if `papercamp/config.json` already exists, and never overwrites an existing file. |
| `paper-camp dev [-p, --port <number>]` | Starts a plain `node:http` server (`src/cli/dev-server.ts`): `/api/*` via `createApiMiddleware`, everything else served statically from the built `dist/app` with an `index.html` SPA fallback. Defaults to port 3333. Errors out with a pointer to `pnpm build` if `dist/app` is missing; kills any running agent task on SIGINT/SIGTERM. |
| `paper-camp add plan <name> [-k, --kind <kind>]` | Writes a new entity file at `papercamp/ideas/<ID>.md` via `formatEntityFile`, minting the next lifetime `IDEA-N` id. The subcommand name is legacy — every entity it creates lives idea-shaped until phases get drafted into it. |
| `paper-camp doctor [--fix] [--bump-format]` | Validates corpus structure: frontmatter schema, id/counter integrity, phases-list integrity, archive placement, dangling links. `--fix` applies the migrations it knows how to perform (currently archive placement); `--bump-format` stamps the corpus format version for review as a git diff. |
| `paper-camp audit` | Runs the convergence-audit agent over every non-note entity with `status: review`/`done`, skipping ones whose `audited` stamp is at least as new as the file's mtime; stamps `audited` on success and prints an audited/skipped/failed summary. |
| `paper-camp migrate` | One-time migration from the legacy two-file corpus (see "Migration history" above). |
| `paper-camp mcp` | Starts the MCP stdio server exposing entity read/write tools to any MCP client. See [`docs/MCP.md`](../docs/MCP.md) for the tool reference. |
| `paper-camp stamp-release <version>` | Stamps `released: <version>` onto every idea that version shipped, resolved from the release commit range. |
| `paper-camp release-notes <version>` | Prints release notes grouped by idea rather than by raw commit. |
| `paper-camp resolve-pr <ref>` | Resolves the entity a PR (number or branch) mirrors and prints its kind/tags/phases as JSON. Used by the CI workflows. |
| `paper-camp validate-pr-title <ref>` | Fails if a PR's title is not a conventional-commit title — the squash-merge commit inherits it verbatim. Used by the CI workflows. |
| `paper-camp sync-pr-{phases,labels,title,readiness,consistency} <ref>` | Five commands that push entity state onto its PR: rewrite the PR body's phase checklist, apply labels derived from the plan, retitle to `<type>(<scope>): <Idea title> (IDEA-N)`, flip to ready-for-review once every phase is checked (or close it when the plan is dropped), and upsert a sticky comment carrying `findConsistencyIssues` output. All used by the CI workflows. |
| `paper-camp session-focus` | Prints a SessionStart focus block for the current project. Used by the Claude Code hook below. |

---

## Claude Code native integration

Paper Camp plugs into Claude Code itself rather than only offering a dashboard: any project
with a `papercamp/` folder gets its memory loaded and kept current with zero prompting.
`paper-camp init` scaffolds two surfaces (`scaffoldClaudeCodeIntegration` in
`src/core/scaffold/scaffold.ts`, static contents in `templates.ts`), each following init's
no-clobber contract — an already-present file is left untouched.

1. **The skill** (`.claude/skills/paper-camp/SKILL.md`) — auto-discovered whenever the
   working directory contains `papercamp/`. Instructs the assistant to read the corpus
   before working, to work one phase at a time, and to keep phases and status honest as it
   goes. This repo's own copy is the source the template mirrors.
2. **The SessionStart hook** (`.claude/settings.json`) — shells out to
   `paper-camp session-focus` (`src/cli/session-focus.ts`, exporting `buildSessionFocus`)
   on every new session. It *derives* a focus block from live data rather than reading a
   hand-maintained file: the active entity (preferring the one tied to the current feature
   branch via `getFeatureBranchPlanId`, falling back to `findFocusPlan` over
   `readWorkEntries`) with its phase progress. Prints a
   `hookSpecificOutput.additionalContext` payload for Claude Code to inject, or exits
   silently if no `papercamp/ideas/` directory exists.

The hook resolves the `paper-camp` binary via `$CLAUDE_PROJECT_DIR`, pointing at
`node_modules/.bin/paper-camp` in the consuming project, since a fresh install ships only
`dist/cli/index.js`.

Two earlier surfaces were removed rather than kept: a git post-commit auto-logger and an
opt-in PostToolUse new-file logger. Both wrote to a tracked changelog file after every
commit or write, which re-dirtied the working tree in a loop. Git history and the entity's
own thread already cover that ground.

---

## Where the code lives

`AGENTS.md` holds the codebase map — `src/core/`, `src/app/server/`, `src/app/features/`,
`src/cli/`, `src/mcp/`, `src/toolbar/` and what each owns — and it is maintained alongside
the code. Read it there rather than looking for a duplicate here.

Two references outside it worth knowing: [`docs/MCP.md`](../docs/MCP.md) for the MCP tool
surface, and [`docs/CODE_STYLE.md`](../docs/CODE_STYLE.md) for how `src/app` code is
written.
