---
id: IDEA-14
title: Review-found phases
---

## IDEA-14: Review-found phases

A `/code-review` pass against a plan's implementation surfaces real findings (bugs, cleanup, conventions violations) that today only exist as chat output — nothing persists them, and nothing lets you act on one with a click the way [[IDEA-4]]'s "Start agent" button already lets you act on a planned phase.

The first design considered was a separate `bugs`/`updates` entity type, parallel to plans, linked back to the plan it was found against (the same shape `ideas.md` already uses for idea→plan links). Rejected as overbuilt: it means a new markdown file, its own parser/schema/serializer support, a new sidebar section, and a duplicate of the per-phase "Start agent" wiring [[IDEA-4]] already built and tested — all to express something that's structurally just "another unit of work on this plan."

**Simpler shape: review findings become new, unchecked phases appended to the plan they were reviewed against.** This gets the existing per-phase machinery for free — the "Start agent" button, the running-phase spinner, the post-run "did it actually check off the box" verification — with zero new infrastructure. The only real gap: a review-found phase needs to read as *not originally planned* at a glance, so it doesn't look like scope the user wrote themselves.

**Marking, roughly:**

- `PhaseItem` gets an optional `source` field (e.g. `source?: 'review'`), parsed from a small inline tag on the phase's checkbox line in `plans.md` (e.g. `- [ ] [review] <finding summary>`) rather than a separate markdown section — keeps phases as one list, ordered however they were added, instead of two competing lists to reconcile.
- In the Phases table (`plan-detail.tsx`), a review-found phase gets a small `Stamp`/badge next to its title (mirroring how tags already render) and a slightly different row background so it reads as distinct without a second table or section.
- **Open implementation gap, not yet decided:** paper-ui's `Table` has no per-row styling hook today — only per-cell `cell` render functions. Giving a row its own background means either adding a small generic `rowClassName?: (row, index) => string` prop to paper-ui's `Table` (a real, if small, addition to the shared sibling repo, not just a paper-camp change) or finding a paper-camp-only way to fake it from inside a cell. Worth resolving deliberately when this gets built, not mid-flight.
- The finding's `failure_scenario`/file:line detail from the review (already produced today by `/code-review`'s JSON output) becomes the phase's `description` — same field that already renders in the expandable row for ordinary phases.

**Decisions worth making explicit:**

- **One plan, one phase list — review findings are not a parallel track.** This avoids the "which list is authoritative" question a separate entity type would raise, at the cost of phases no longer being purely "things planned in advance."
- **Marking is cosmetic/informational, not a different lifecycle.** A review-found phase still goes through the exact same checkbox/Status-honesty rules ([AGENTS.md](../AGENTS.md)'s "update the plan as you go") as any other phase — it just looks different.
