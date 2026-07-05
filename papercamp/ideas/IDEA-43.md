---
id: IDEA-43
title: Unified ideas and plans worklist
---

## IDEA-43: Unified ideas and plans worklist

Ideas and plans live as two lists (`/` and `/ideas` since FEAT-37 phase 4), but the workflow is one: capture an intention, refine it (AI extend or real-world investigation), draft plan(s) from it, then track only the plans. Merge the two into one worklist where ideas are grouping context, not tracked items.

- **Two-level tree in the same row language.** The unified list shows idea rows as parents — lightbulb icon, title, Extend/Draft-plan actions, and a derived children summary ("2/3 plans done") instead of a status stamp — with their linked plans (via the existing `idea:` backlink) indented beneath as ordinary `plan-rows.tsx` rows (slight inset + thin connector line). Plans without an idea stay top-level. Hard boundary: one level only — no idea-under-idea nesting, or we've reinvented epics with ceremony.
- **Ideas stop having tracked status.** A default idea carries no status field at all — nothing asserted, nothing to go stale; its "state" is purely the children summary. `deriveIdeaStatuses` and the planned/done Ideas board columns retire.
- **`kind: note` for ideas that never need a plan.** Declared at creation (a toggle on the New-idea modal): notes get a manually-set `open → done/dropped` status, a distinct icon, and their own filter chip. The zod schema (`ideaFrontmatterSchema`) enforces the asymmetry — `status` is only valid on `kind: note` — so plan-bearing ideas can never carry a stale hand-set status. `IDEA-37` retroactively becomes the first note; this generalizes the "Planless ideas close via explicit frontmatter status" decision.
- **Ideas get the dated log grammar.** Reuse plans' `### Log` (`- date: text`) in idea bodies so refinements append as history instead of mutating the original intent — the parser already knows the shape, and AI extend gets a structured place to write.
- **Naming untangles.** With idea rows and `status: idea` plans sharing one list, the two creation paths must read crisply: "New idea" (refine-first) vs "Quick plan" (act-directly, today's Add-to-backlog); the plan-status stamp already reads "Backlog".
- **Supersessions to record when this lands:** the Ideas-vs-Backlog visual separation decision, and FEAT-37 phase 4's separate `/ideas` route (its row-card ideas list and New-idea button carry into the unified view; the route and header nav item go away).

Builds on [[IDEA-42]]'s flat filtered/sorted list — filters and sorts become group-aware (a group sorts by its most-advanced child; done children can collapse behind "+N done" once a group outgrows ~5 rows). No storage migration: ideas and plans stay separate file types; the tree is derived from `idea:` backlinks. [[IDEA-44]] adds the capture-time overlap check this unified list makes natural.

### Evolution (2026-07-05): single-file entities

The worklist unification above shipped as FEAT-42; this extends the same intention one level deeper — from unifying the *lists* to unifying the *files*. Ideas and plans converge into **one file per entity**: the entity is called an *idea* for its whole life, and a plan is just a section inside it — no more duplicated rationale across two files, no `idea:` backlink, no drift between two descriptions of the same intent. The insight that makes this cheap: the unified file is essentially today's plan file born earlier — frontmatter (id, title, type, status, tags, dates) + prose rationale + `### Log` + `### Clarifications` + `### Phases`. An idea is that file before phases exist; "creating a plan" is the drafting agent writing the Phases section into the file that's already there, and the UI flips from idea-shaped to plan-shaped on one derivable fact: are there phases yet.

- **Merge direction: plan file is the base.** For every 1:1 idea↔plan pair, fold the idea's prose and Log into the plan file (single rationale, concatenated logs, plan frontmatter wins), then the combined file *is* the idea. Plans without ideas are already complete; ideas without plans (including `kind: note`) are already valid entities and stay as they are.
- **Full legacy migration — nothing left behind.** All archived plans merge too; legacy bodies get simplified to a brief "what this was about" summary during the rewrite (no need to preserve tons of superseded detail — git history keeps the full text). Ideas that spawned multiple plans are **split into one idea per plan**, each with a short body derived from the shared parent; the old multi-plan idea file retires.
- **One plan per idea, by construction.** The file format makes it structural. Thematic grouping ("everything UI", "everything CI") moves to a separate lightweight *topics* entity (epic-like: single-assignment, own identity/description, user-creatable) — a follow-up idea, not this one. This replaces the two-level idea→plans tree described above: the worklist becomes topics→ideas instead, and the group-aware selector/renderer FEAT-42 built transfers with the parent swapped.
- **`type` field.** Today's `kind: feat | fix | chore | docs | refactor` renames to `type` during the rewrite; values stay Conventional-Commits-shaped since they drive commit types and branch prefixes. `kind: note` (planless ideas with manual open/done/dropped status) carries over unchanged — the new model handles that case natively.
- **Scanner/readers adapt.** `readPlansMerged`/`readIdeasMerged` collapse into one reader over one directory; `parsePlanFile`/`parseIdeaFile` converge on one schema (phases optional); index generation becomes one table. The old two-file shapes need reading support only as long as the migration is in flight — after it, the merged-reader fallbacks retire.
- **Status model.** The existing `PlanStatus` enum already fits the unified lifecycle: `idea` (no phases yet) → `planned` → `in-progress` → `review` → `done`/`dropped` — the long-awkward `idea` status finally means what it says.
- **Ids (decided 2026-07-05):** one lifetime `IDEA-N` per entity, unchanged when the plan section lands; `type` drives commit types and branch prefixes (`feat/idea-99-…`), `Refs:` footers carry the `IDEA-N`, and the per-kind `nextId` counters collapse into one. See the "Entity ids are lifetime IDEA-N" decision.

Sequencing: first the file merge + scanner adaptation as its own plan, then a separate UI-adaptation plan (detail view morphing idea→plan, worklist as topics→ideas, topics entity) — both drafted from this idea. [[IDEA-44]]'s overlap check survives and gets stronger: with one entity there is exactly one capture point.

### Log
- 2026-07-05: Extended with the single-file approach — one file per idea with the plan as a section, full legacy migration with simplified bodies and multi-plan splits, topics as the follow-up grouping entity. Supersedes this idea's own idea→plans tree model once it lands.
- 2026-07-05: ID convention decided — lifetime `IDEA-N` for every entity; nothing blocks drafting the migration plan.
