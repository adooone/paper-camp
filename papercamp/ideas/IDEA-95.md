---
id: IDEA-95
title: Roadmap items become the subject vocabulary
status: idea
created: 2026-07-26
updated: 2026-07-26
subject: Planning surface
---

`subject` and `tags` currently answer overlapping questions. Tags are subsystem areas — `app` (63 uses), `plans` (28), `ui` (26), `core`, `git` — the same vocabulary the commit scopes use, so a tag says *where in the code* work lands. But the configured subjects (`Frontend`, `App UI`, `Code health`, `Workflow`, `Mobile control desk`) are mostly just coarser versions of the same thing: `Frontend`/`App UI` restate the `ui`/`app` tags, `Code health` restates `refactor`. Two fields, one axis, and the finer one is already better maintained.

Roadmap items are the axis that is actually missing: `Packaging`, `Ambient agents`, `Richer review loop`, `Multi-project`, `Project genesis` — the bigger bets an entity belongs to. Use those as the subject vocabulary and each field answers exactly one question: **tags = where in the code, subject = which bet**.

The codebase already half-believes this. `POST /api/roadmap/promote` mints a subject from the parent roadmap item's name (`ensureSubject`, with the comment "a big bet graduates as a Subject"), and `Mobile control desk` is already both a roadmap item and a configured subject. This finishes a migration that started by accident.

Payoff beyond tidiness: horizons come along for free as a grouping and ordering axis over subjects — H1 subjects are near-term work, H3 are long bets — so the worklist can group or sort by horizon without a new concept. It also strengthens the provenance trail ([[IDEA-93]]): an entity's subject becomes a real pointer back to the roadmap item that motivated it, rather than a loose label.

**Hard dependency: [[IDEA-91]] must land first.** Promotion currently deletes the item from `ROADMAP.md`, so a subject would point at something that no longer exists the moment work starts on it. Items have to survive promotion before they can serve as a vocabulary.

Open questions for the plan:
- `Workflow` is the most-used subject (10 entities) and `Code health` (2) — neither is a roadmap item. Either they graduate into roadmap items (they are arguably long-running bets) or they retire and those entities get remapped. This decides whether the roadmap is the complete set of themes or just the near-term ones.
- Where the vocabulary lives: reading it from `ROADMAP.md` makes the roadmap the source of truth and retires `config.json`'s `subjects` array plus `ensureSubject` — or config keeps a cache. Prefer the former; one source of truth.
- Entities with no bet (e.g. a one-off fix like [[IDEA-84]]) need "no subject" to stay a first-class, non-awkward state.
- Whether subject is stored as the item name (simple, human-editable, needs validation) or a stable id (rename-safe). Names match the corpus's plain-markdown character; renames would need a migration pass either way.

Provenance: proposed 2026-07-25 after noticing the subject/tag overlap while reviewing the roadmap work.

Groundwork done 2026-07-25: every active entity now carries a subject drawn from this
vocabulary, so the migration starts from a clean corpus rather than a mixed one. The old
free-form subjects were retired — `Workflow` (5 uses) and `Frontend` dissolved into the
bets or standing concerns they actually belonged to, and `config.json`'s `subjects` array
now lists the ten-term vocabulary. Archived entities were deliberately left alone; backfill
them only if [[IDEA-92]]'s timeline or [[IDEA-93]]'s trail turn out to need history.

`ROADMAP.md` gained a `## Standing concerns` section for the threads that never ship and
never graduate — Infrastructure, Planning surface, App UI, Code health, Testing — so work
serving no single bet still has a home. **Constraint for the implementer:** `src/core/roadmap.ts`
only recognizes headings matching `## Horizon N — …` (`HORIZON_HEADING_RE`), so that section
parses as nothing today and is invisible in the roadmap UI. Making standing concerns
first-class subjects means teaching the parser about non-horizon sections — decide then
whether they are a distinct kind alongside horizons (they are not time-ordered, so folding
them into the horizon list would misrepresent them).
