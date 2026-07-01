---
id: IDEA-8
title: Ideas board
---

## IDEA-8: Ideas board

Today every `ideas.md` section renders flat in a single "Ideas" grid (`list-view.tsx`'s `ideaEntries.map(...)` → `IdeaCard`), as a long, un-prioritized, un-titled blob of prose per card. Nothing distinguishes a brand-new idea from one that shipped months ago, nothing says which one matters more, and the card title is whatever the first line of prose happens to be — for several of the entries already in this file, that's a full sentence. This replaces the flat grid with a real two-column board: **Planned** and **Done**.

**Idea entries need real structure, the same way plans/decisions/open-questions already have it.** Right now `ideas.md` is parsed client-side by a one-off `parseIdeas` in `src/app/stores/app-store.ts`, splitting on `---` and grabbing the first heading line as `title` — it's the only one of the four `papercamp/` files not going through the shared `src/core/parser.ts`/`src/types/index.ts` layer. This is the moment to fix that: give ideas a real `IdeaEntry` type (`id`, `title`, `body`) and a `parseIdeas` in `core/parser.ts` alongside `parseDecisions`/`parseOpenQuestions`, parsing a heading shaped `### IDEA-7: Short title` (the `IDEA-N` prefix from the "Plan & phase IDs" idea above, now load-bearing rather than decorative).

**Short titles, same rule as plans:** the heading becomes a true short title (3–6 words), not the current sentence-length headings — several already in this file need a rewrite pass once this lands (e.g. "Repo health status — live lint/format/test results in The Stack" → "Repo health status"). Whatever context that's lost from the long heading already lives in the body prose below it; nothing new needs writing, just trimming the heading.

**Priority is positional, not a stored number.** No `**Priority:** 3` field gets added — that would be one more piece of state to keep in sync by hand. Priority *is* the order ideas appear in `ideas.md`, top to bottom; reordering priority means reordering the sections in the file. The board shows ideas within each column in that same source order (highest priority first), optionally with a small rank number for readability, but the number is read off position, never set independently of it. A "move up"/"move down" control (swapping two adjacent sections' order in the file via a small write endpoint) is a fine v2 — v1 can ship fully read-only, since reordering by hand-editing the file works today and isn't blocked on any UI.

**Planned vs. Done, derived exactly as the previous version of this idea specified:** an idea is "Done" only when *every* plan linking to it (via the plan's `**Idea:** IDEA-7` field) has `Status: done` or `dropped` — checking all linked plans, not just one, so a partially-realized idea stays in "Planned." Everything else (including ideas with zero linked plans yet) is "Planned." Still nothing stored on the idea side for this — same "derive, don't duplicate" reasoning as before.

**Idea ↔ plan linking is asymmetric, matching how the data actually works:** a plan has exactly one `Idea` field (a plan grows out of at most one idea), but an idea can have many plans pointing at it (one idea, several plans built against it over time) — this is already the natural shape once the plan side stores the link and the idea side only ever derives its plans by scanning for matches, no change needed to make the cardinality work, just confirming it. Each idea row, when expanded, lists every plan that links to it as a clickable `Stamp` per plan ID (`FEAT-2`, `FIX-9`, ...) — the same plan→idea link already proposed, just rendered from the other direction.

**Look:** two columns side by side, reusing `kanban-column.tsx`'s column shell from the existing Board view (`board-view.tsx`) rather than inventing new column chrome — header + count, vertical list of rows. Each row: a small icon (the existing `LightbulbIcon` for "Planned", a checkmark icon for "Done"), the short title, and — on expand/click — the list of linked plan `Stamp`s described above. This sits where the current "Ideas" grid section lives in `list-view.tsx`, or could reasonably become its own small view if the two-column layout doesn't fit naturally inside the existing list/board toggle.

**Decisions worth making explicit:**

- **Hard dependency on the Idea-ID backlink field** from "Plan & phase IDs" above — none of Planned/Done, priority order, or the plan-link list work without it; don't start this before that field exists.
- **Migrating existing ideas.md entries** — the file's five current entries (as of this session) need a one-time pass to add `IDEA-N:` prefixes and shorten their headings; not a blocking schema migration (old unprefixed headings can render with no ID badge), but worth doing in the same pass so the board doesn't launch with half its cards missing IDs.
- **Read-only priority for v1** — explicitly deferring drag-to-reorder/up-down controls until the simpler "priority = file order" version proves the column layout itself is right.
