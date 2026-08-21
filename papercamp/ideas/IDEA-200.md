---
id: IDEA-200
title: Resync about.md with the codebase
type: docs
status: idea
created: 2026-08-21
tags:
  - docs
  - corpus
subject: The format as the product
---

`papercamp/about.md` is the technical reference for how Paper Camp stores and
reads a corpus — 556 lines that agents and the docs page both read. Large parts
of it describe a codebase that no longer exists. Unlike ordinary doc rot this one
actively misleads: an agent following it will look for files and functions that
were deleted.

### What it still claims

**Three monolithic corpus files.** `decisions.md`, `open-questions.md` and
`progress.md` are documented in the directory layout, in the file-purpose table,
in a "why these stay monolithic" rationale, and in three sections defining their
record grammars. All three files are gone — thread messages on the owning entity
replaced them, and `progress.md` was removed from the product outright.

**A generated `ideas/index.md`.** Documented as regenerated on every write and
never hand-edited, including in the `paper-camp init` and `add plan` command
descriptions. There is no `index.md` under `papercamp/ideas/`.

**Functions that no longer exist.** `formatEntitiesIndex`, `parseDecisions`,
`parseOpenQuestions`, `parseProgress`, `formatProgressEntry` and
`readPlansMerged` are all described in the module-by-module section; none of them
is in `src/` any more. `findConsistencyIssues` survives and is described as
cross-checking decisions and questions, which it cannot still do.

**A route and a page that were removed.** `routes/docs.ts` and its
`POST /api/open-questions/resolve` endpoint are documented; there is no
`routes/docs.ts`. The Docs page is described as having Decisions, Open Questions
and Progress sections with a cross-linked resolve-question flow.

**`### Log` as the body section.** Entities carry `### Thread` now, with typed
messages; `### Log` appears in the entity-shape description and in the parser
notes.

### What this plan does

Rewrite the false sections against the code, section by section, verifying each
claim rather than pattern-matching the prose. A claim about a function is checked
by finding that function; a claim about a file is checked by looking for the file.
Anything that cannot be verified is deleted rather than reworded — an
architecture reference that is 90% true is worse than a shorter one that is
wholly true, because nothing marks which 10% to distrust.

The passages describing the unified entity storage, the id lifetime rule, and the
storage-decision rationale are still accurate and stay.

### Why it is worth doing rather than deleting

`about.md` is the only document explaining *why* the corpus is shaped the way it
is — the markdown-over-database call, the per-file-vs-monolithic reasoning, the
id-never-reused rule. That reasoning is what stops it being re-litigated. The
parts that rotted are the inventory sections, which are exactly the parts a
rewrite can verify mechanically.

### Out of scope

Changing the corpus format or any code. `AGENTS.md`, `USAGE.md`, `docs/MCP.md`
and `docs/CODE_STYLE.md` were resynced on 2026-08-21 and are not part of this.
