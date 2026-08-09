---
name: paper-camp
description: Work inside a project that has a papercamp/ folder — its per-file plans and ideas, with decisions and open questions logged as notes on the idea they bind. Use this whenever the working directory contains papercamp/ (papercamp/plans/, papercamp/ideas/), and especially before starting, continuing, or completing any plan phase, drafting an idea, logging a decision, or answering "what are we working on / what's next".
---

# Paper Camp

Paper Camp is this project's planning methodology: plans and ideas live as
markdown files under `papercamp/`, with decisions and open questions logged as
notes bound to the idea they concern. This skill tells you how to read that
state before acting and how to keep it honest as you work.

## The MCP is the write path

If a `papercamp` MCP server is connected in this session, every change to the
corpus goes through its tools — not a raw file edit. The tools own the file
grammar and enforce the guards (id allocation, branch conflicts) the format
assumes; hand-writing the grammar from examples re-derives it slightly wrong
each time and corrupts the file's structure. Reads go through the tools too, so
you see the same shapes a write will expect.

- **Read**: `list_plans`, `get_plan`.
- **Create** an idea → `add_idea`; a typed work entity → `draft_plan`.
- **Edit** an existing entity's title, body, tags, or type → `edit_idea`.
- **Toggle a phase** done/not-done, optionally setting status → `update_phase`.
- **Append a thread note** — one tool per kind, so you never write the note
  grammar by hand: `append_log`, `append_clarification`, `append_decision`,
  `append_note`.
- **Promote** a suggestion → `promote_suggestion`; a roadmap item or candidate
  → `promote_roadmap_item`; a thread message into a durable decision/log →
  `promote_thread_message`.
- **Archive (drop)** an entity → `archive_entity`.

Raw file edits are a fallback for when no `papercamp` MCP server is connected.
Only then, edit the markdown directly, mirroring the structure of the existing
files under `papercamp/` exactly (see the grammar note at the end). Everything
else in this skill still applies conceptually; only the mechanism changes.

## Before doing any work

Read, in this order, whatever exists:

1. `papercamp/plans/index.md` — every plan's id/title/status/tags, at a glance.
2. The specific plan file at `papercamp/plans/<ID>.md` (e.g. `FEAT-31.md`) for
   the plan you're about to work on. Each plan is YAML frontmatter (`id`,
   `title`, `kind`, `status`, `tags`, ...) plus prose, then a `### Phases`
   list of `- [ ]`/`- [x]` checkboxes with an indented description under each.
3. `papercamp/ideas/index.md` and any linked idea file — plans often trace
   back to an `idea:` field; the idea explains *why*, the plan explains *what*.
   Its notes carry any decision or open question bound to it — settled calls
   you shouldn't re-litigate without flagging it to the user first, and
   unresolved questions that might block or redirect the work you're about
   to start.

Skip files that don't exist yet (a fresh project may have empty logs).

## While working

- Work one plan phase at a time unless told otherwise — don't cascade into
  later phases just because they look quick.
- If a phase's boundary or intent is unclear, ask before continuing.
- Prose in plans and ideas is more current than your memory of past
  conversations. If they conflict, the files win — say so and resync.

## Keep the project current as you go

Route each of these through the MCP tool named below; fall back to the raw-file
mechanics (in parentheses) only when no `papercamp` MCP server is connected.

- **Plan phases**: when you finish a phase, mark it done with `update_phase`
  (raw fallback: flip that one checkbox from `- [ ]` to `- [x]` in the plan's
  frontmatter file — change only that line, don't touch other phases or prose).
- **Plan status**: keep the plan's status honest
  (`planned` / `in-progress` / `review` / `done`) via `update_phase`'s `status`
  (raw fallback: edit the `status:` frontmatter field). When every phase is
  checked, set status to `review` — never `done`. `done` is a human-only
  promotion after review; an agent finishing the last phase does not close
  the plan itself.
- **Decisions / open questions**: if you settle something ambiguous while
  working, log it with `append_decision` on the idea it bounds; if you surface
  a question you can't resolve yourself, add it with `append_note` on that idea
  rather than guessing silently (raw fallback: append the note by hand in the
  idea file's thread).

## What this skill deliberately does not do

It does not maintain a separate "current focus" file — that's derived at
session start from live plan data, not hand-maintained here. It does
not define the file formats in full; treat the existing files under
`papercamp/` as the grammar reference (mirror their structure exactly rather
than inventing a new shape).
