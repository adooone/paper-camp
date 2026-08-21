---
id: IDEA-196
title: Make the comment check enforceable
type: chore
status: idea
created: 2026-08-21
tags:
  - code-health
  - tooling
subject: Code health
order: 3
---

`docs/CODE_STYLE.md` §7 states a rule about *individual comments* — a comment
must fit in one line, two at the absolute most. `scripts/comment-stats.mjs`
measures something else entirely: an aggregate comment-line ratio across `src/`.
The two are unrelated, so the rule has never been enforced by anything.

### What the script actually does today

Measured 2026-08-21, not assumed. The counter is **accurate in aggregate**:
1597 comment lines against 1600 counted by TypeScript's own comment-trivia
ranges over the same 310 files — a 0.2% difference. The problem is not
precision, so this plan must not "fix the count".

Three real defects:

**It never fails.** Its own header says "informational only, never fails". It
is not wired into CI, husky, `pnpm lint`, or the app's Quality check. The only
consumer is `src/core/stats.ts`, which shells out to it for the stats view. There
is no job gating anything, which is the gap this closes.

**It measures density, where the rule is about length.** One 6-line comment and
six 1-line comments produce an identical ratio. Across `src/` there are 762
comment blocks; **188 exceed the 2-line cap and hold 709 lines — 44% of every
comment line in the repo**. Nothing reports that number.

**It is biased against the shape the guide prefers.** A trailing comment
(`return h.slice(1, h.indexOf(']')); // [::1]:3333`) is never counted, because
the classifier only inspects lines that *start* with `//`. `src/app/server/api.ts`
has 7 such lines. The one-line form the guide asks for is invisible to the metric,
while the multi-line blocks it forbids are counted in full.

### What it becomes

A **hard gate on comment-block length**, reported through the app's Quality check
alongside lint and format. The ratio stays in the JSON output for the stats view,
but it is no longer the pass condition.

**The rule.** A run of consecutive comment lines may not exceed 2 lines. A run
is contiguous comment lines with no code between them, so three stacked `//`
lines are one 3-line violation, not three legal comments.

**JSDoc on exported symbols is exempt.** A `/** … */` block documenting an
exported function's contract is API documentation and may run long;
`groupRowsBySubject`'s 10-line block in
`src/app/features/plans/helpers/plan-list-selector.ts` is legitimate and stays.
The exemption is narrow: `/** … */` immediately preceding an `export`. A
`/* … */` block inside a function body is not JSDoc and is capped like any other.
This split is where the volume is — of the 188 over-cap blocks, only 47 are
JSDoc (190 lines) against 141 inline runs (519 lines).

**Trailing comments count.** `code; // why` must be classified as a comment line
so the gate sees the form it is meant to encourage.

### The existing violations are in scope

A gate that ships red is not a gate. The 141 inline runs — 519 lines — are
rewritten to fit the cap or deleted as part of this work, so the check is green
the day it lands. Deleting is the expected outcome more often than rewriting:
§7 says the default number of comments is zero, and most of these narrate a
decision that belongs in the commit message.

`src/app/features/plans/` holds 28 of them (108 lines) and is the pilot; the rest
are concentrated in `src/app/server/` and `src/core/`.

### Out of scope

Changing the 2-line cap itself. Diff-scoping the gate — it runs over all of
`src/`, which is only tenable because the cleanup above is in scope. Counting
comments in tests, which the walker already excludes.

### Phases
- [ ] Detect over-cap comment runs in the script
      Group each file's comment trivia into contiguous runs, flag runs longer than 2 lines, and count trailing `code; // why` lines the classifier currently ignores.
- [ ] Exempt JSDoc immediately preceding an export
      Only `/** … */` directly before an `export` is exempt; `/* … */` inside a body is capped.
- [ ] Make the check fail and keep the ratio in JSON
      Drop the "informational only, never fails" behaviour; the ratio stays in the JSON output for the stats view but is no longer the pass condition.
- [ ] Clear the pilot violations in src/app/features/plans/
      Rewrite to fit the cap or delete; deleting is the expected outcome for decision-narrating comments.
- [ ] Clear the remaining violations in src/app/server/ and src/core/
- [ ] Wire the gate into the app's Quality check alongside lint and format
