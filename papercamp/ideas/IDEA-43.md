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
