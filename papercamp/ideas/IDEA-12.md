---
id: IDEA-12
title: Plan/decision consistency check
---

## IDEA-12: Plan/decision consistency check

`decisions.md` and `open-questions.md` are the two files in `papercamp/` that exist specifically to stop a project from re-litigating settled questions or losing track of blockers — but nothing today checks whether they're internally consistent, or whether an unresolved open question is actually blocking work that's marked `in-progress` anyway. `spec-kit`'s `/analyze` command runs exactly this kind of check across its own artifacts (spec/plan/tasks): a read-only, severity-graded findings pass, never a write. The equivalent here is small enough to be entirely derivable from data already parsed — no AI call needed for v1, same "derive, don't duplicate" approach `deriveIdeaStatuses` (`src/core/parser.ts:253-265`) already uses for Idea status.

**Checks worth running, all pure functions over already-parsed entries:**

- **Dangling cross-references** — an `OpenQuestionEntry.resolvedBy` (`src/types/index.ts:67`) or `DecisionEntry.supersededBy` (`types/index.ts:59`) whose value doesn't match any actual entry title. These links are currently rendered as clickable (per IDEA-1's "Cross-linking between the two"), so a typo'd or stale title silently produces a dead link today with nothing surfacing it.
- **Open questions blocking active work** — needs one new optional field to express the link honestly: `OpenQuestionEntry` gains `blocks?: string` (a plan `id`, e.g. `FEAT-2`), parsed and serialized the same way the existing optional `Idea:` field on `PlanEntry` already is. A finding fires when a question with a `Blocks:` field is still `open` while that plan's `status` is `in-progress` or `review` — surfaced as "open question is blocking active work," the single most useful flag this idea produces.
- **Orphaned `decided` decisions** *(stretch, not required for v1)* — a decision with no plan ever referencing it isn't necessarily wrong (plenty of decisions are about process, not a specific feature), so this is a weaker signal than the two above; worth deferring until the two structural checks prove useful on their own.

**Where it renders** — as a fourth pill in the Stack panel's existing "Status" section (IDEA-5: `src/app/components/stack-panel.tsx`), next to Lint/Format/Tests, labeled "Consistency." States: `clean` (no findings) or a count (`"2 issues"`), same `Stamp` component, same click-to-expand pattern the lint/format pills already use for showing failure detail — except the expanded content here is a short list of findings (one line each, e.g. "Open question 'Should plans support sub-tasks?' blocks FEAT-7 (in-progress)"), each clickable through to the Docs page's decision/open-question view (IDEA-1) or the blocking plan itself. Reuses the panel's existing disclosure affordance rather than inventing a new one.

**Decisions worth making explicit:**

- **No AI involved in v1.** Every check above is a structural join over fields that already exist or are trivial additions — `spec-kit`'s `/analyze` does ambiguity/duplication detection that genuinely needs an LLM; the highest-value findings for this project's actual data shape don't.
- **`Blocks:` is optional and asymmetric, matching how `Idea:` already works** — a plan doesn't need to know which questions block it; the open question declares the dependency, the same direction `Idea:` already points (plan → idea, not idea → plan).
- **Read-only, same as `/analyze`.** This never edits `decisions.md`/`open-questions.md`/`plans.md` — it's a lint pass over docs, surfaced where the existing lint/format/test pills already live, not a new write path.
