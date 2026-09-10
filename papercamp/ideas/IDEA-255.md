---
id: IDEA-255
title: Verify once, after the last phase
type: feat
status: idea
created: 2026-09-10
tags:
  - server
  - agent
subject: Run & monitor
order: 1
---

The seven-phase run of [[IDEA-247]] took 61 minutes of wall clock for
about nine hundred changed lines, and most of it was not writing code.
Each phase is a fresh headless session that rebuilds its map of the
repository before touching it; the phase prompt says to verify with
`pnpm run check-types`, and the agent reads that as check-types, lint,
and the full test suite, run twice; then `runQueue` in `agent.ts` runs
the biome fixer, lint, and the full suite again before it commits. The
suite is eighty seconds, so a phase pays four minutes of tests for three
changed files, seven times over. Interactive work on the same idea keeps
one context and runs only the tests it touched, and is two to three
times faster for it. Run-all should work the same way.

**No checks between phases.** `runQueue` drops the per-phase verify and
fix loop. A phase ends when the agent stops; the phase is committed as it
is, the checkbox is ticked, and the next phase starts. The baseline that
tells pre-existing red from introduced red is taken from the checks'
last results when they were produced on the current HEAD, and run once
before the first phase only when no such results exist.

**One verification at the end.** After the last phase, the run executes
the same sequence it ran per phase today, once: the biome fixer, lint,
the full test suite, consistency, and docs. Anything red that the
baseline did not have goes to the fix pass, resumed in the run's session
so it knows what it just wrote, with the same two-attempt cap; a fix
that lands is committed as its own `fix` commit on the run. The Log
shows one verify row per run instead of one per phase, and the idea's
review stamp is set only after that row is green or the cap is spent.
*Run* on a single phase or fix keeps its own verify, since there is no
later point to defer to.

**The agent verifies nothing but types.** The phase prompt says, in one
sentence: run `pnpm run check-types` when you have finished editing, and
run a test file only if you edited that file; do not run lint, format, or
the test suite, the run verifies them once after the last phase. The
fix-pass prompt keeps its full list, since it is the verification.

**One session for the whole run.** Phase two resumes phase one's session
with the `--resume` flag the adapter already supports for fix passes, so
the map of the code is built once. The stream's usage line reports the
context each turn carried; when the last turn of a phase exceeded 120k
input tokens, the next phase starts a fresh session instead. The run
card shows which session a phase ran in, and the phase's run stamp keeps
its own timing and tokens as today.

**Fewer, larger phases.** `BREVITY_CONTRACT` in `prompts.ts` changes from
3–7 phases to 3–5, and the plan-draft prompt gains one rule: steps that
edit the same files are one phase. The audit prompt inherits the same
target so it does not split them back.

### Out of scope

Parallel phases; the tree is one and the commits are ordered. Changing
what the four checks run. Any change to the checks the Stack runs on
demand.
