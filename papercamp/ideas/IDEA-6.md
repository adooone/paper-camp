---
id: IDEA-6
title: Plan and phase IDs
---

### IDEA-6: Plan and phase IDs

Right now a `PlanEntry`'s `title` (`src/types/index.ts`) doubles as both the identifier and the full description — entries like "Build core library: parser, schemas, scaffold, CLI" or "Add board view, plan CRUD, and project branding" are sentence-length, and every place that lists plans (`plan-card.tsx`, `plan-nav-item.tsx`, `kanban-card.tsx`, `plans-sidebar.tsx`) renders that whole sentence. Same problem one level down: a `PhaseItem` (`src/types/index.ts`) is just `{ done, text }`, and `text` is itself a full sentence ("Add AI focus handoff — one-line copy-prompt per phase with plan title and phase number") rendered inline in `plan-detail.tsx` with no way to collapse it. This idea gives both plans and phases a short, scannable identity, with the long version still available but tucked behind a click.

**ID scheme:**

- Every plan gets a permanent ID of the form `<TYPE>-<N>` — `FEAT-2`, `FIX-9`, `CHORE-3` — assigned once at creation and never reused, even if the plan is later deleted. `TYPE` is the uppercased `Kind` field on the plan entry, and `Kind`'s values are spelled exactly like Conventional Commits' own type strings (`feat | fix | chore | docs | refactor`, not "feature") — on purpose, so the ID prefix, the `Kind` field, and the commit `type:` that closes it out are the same word in three places, not three near-matching spellings.
- **Numbering must be a persistent counter, not "scan plans.md and take the highest + 1."** Plans get deleted (there's already a `DELETE /api/plans` route), and a scan-based scheme would silently reassign a freed number to a new, unrelated plan — which breaks the entire point of an ID meant to be searchable in git history. Store `nextId: { feat: number, fix: number, ... }` in `.paper-camp/config.json` (the same file that already holds the icon and project name) and increment it server-side on every plan creation, never derive it from the current file contents.
- Ideas get the same treatment, one level up: `IDEA-N`, assigned in the order they're written into `ideas.md`, rendered as a heading prefix (`### IDEA-9: Plan & phase IDs — ...`, this very entry would be the next number). This is what makes a plan → idea backlink (next point) possible — without a stable idea ID, "this plan came from that idea" has nothing durable to point at.
- A plan entry gains an optional `**Idea:** IDEA-9` field (same pattern as the existing optional `Tags`/`Updated` fields in `src/core/parser.ts`/`serializer.ts`), rendered in the UI as a small clickable badge next to the plan's ID that jumps to the originating section of the Docs page's ideas view (see the "Project docs browser" idea above) or `ideas.md` itself. Not every plan needs one — plenty of past entries here (e.g. "Refresh about.md technical reference") were never an idea first.

**Short titles, long bodies:**

- The `title` field becomes a true short headline (2–6 words: "Parser & CLI scaffold" instead of "Build core library: parser, schemas, scaffold, CLI"). Anything lost from the old long-form title moves into the existing `body` field, which already exists separately from `title` and already holds a paragraph of context for most entries — this is a rewording pass on existing data, not a new field.
- Everywhere a plan is listed, render `<Stamp>{id}</Stamp> {shortTitle}` instead of the bare long title — sidebar, board columns, cards, and the `plan-detail.tsx` header.

**Phase numbering + accordion:**

- Phase number is computed, not stored — just `index + 1` over `plan.phases`, so phases always renumber correctly when one is added, removed, or reordered. No markdown change needed for this part.
- `PhaseItem` gains an optional `description?: string` alongside the existing `text` (renamed to read as the short title). Markdown encoding: the checkbox line stays exactly as today (`- [x] Short phase title`), and an optional indented paragraph on the following line(s) becomes the long description:
  ```
  - [x] Parser with non-fatal warnings
        Handles malformed `### Phases` blocks without throwing — collects a ParseWarning
        instead, so one bad entry doesn't take down parsing for the whole file.
  ```
  `extractPhases` in `src/core/parser.ts` needs to grab indented continuation lines following a checkbox item and join them into `description`, leaving phases with no continuation exactly as they parse today (`description: undefined`) — fully backward-compatible with every phase already written in `papercamp/plans.md`.
  - **A paper-ui `Accordion` component, which doesn't exist yet** (checked `~/dev/paper-ui/src/components` — there's `card`, `code-block`, `tabs`, etc., but no expand/collapse primitive). Needs building first: single-item expand/collapse, chevron or `+`/`–` affordance, height-animated via the same `framer-motion` pattern already used in `stack-panel.tsx`'s `AnimatePresence`, with the usual `variant`/`size` props so it slots into both the light Plans page and a future chalkboard context. In `plan-detail.tsx`, each phase row only gets the accordion's expand control if `description` is present — phases with just a short title (the common case for everything written before this lands) render exactly as they do today, no empty disclosure arrow.

**Commitlint alignment:**

- There's no commitlint/husky setup in this repo today (checked `package.json`, no `@commitlint/*` deps, no `.husky/`). Add `@commitlint/cli` + `@commitlint/config-conventional`, enforcing the same `feat|fix|chore|docs|refactor|...` type vocabulary the plan `Kind` field uses — so a plan's ID and the commit type that closes it are the same word, not two parallel taxonomies that can drift apart.
- Nice-to-have, not required for v1: a custom commitlint rule (or just a convention, enforced by habit/AI prompt rather than tooling) nudging commit messages to include a `Refs: FEAT-2` footer line, so `git log --grep "FEAT-2"` finds every commit tied to a given plan — the actual payoff the user is after ("a ready-made number to search the history by").

**Decisions worth making explicit:**

- **IDs are permanent — deleting a plan retires its number, it does not free it.** This is the one correctness property the whole scheme depends on; get the counter-storage decision above wrong and IDs stop being trustworthy as a history-search key.
- **`Kind` is optional during migration.** Existing `papercamp/plans.md` entries have no `Kind`/ID today; they should render with no ID badge rather than forcing a backfill pass before this can ship. New plans get a `Kind` going forward (prompted at creation, alongside the existing `Status`/`Tags`).
- **Where `Kind` is set:** at creation time only (the "Add idea" modal / `POST /api/plans`), same lifecycle moment as the ID assignment — not editable after the fact, since changing a plan's type after its ID was already referenced in commit history would make that history lie.
