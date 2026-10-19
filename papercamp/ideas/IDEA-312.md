---
id: IDEA-312
title: One visible prioritise run
type: fix
status: planned
created: 2026-10-19
tags:
  - server
  - agents
  - run-order
  - activity
subject: Run & monitor
---

A click on *Prioritise queue* on 2026-10-19 produced two "Prioritise queue"
runs nine milliseconds apart, both finished, with nothing to say what either
returned or why there were two. The second one is `getPrioritiseVerdict`'s
retry: when the first verdict fails validation (a reason count that does not
match the order, a duplicated id, a non-JSON reply) it sends the prompt again
with the error appended, and each `runPrompt` call registers its own task
through `runReadOnlyPrompt`. The panel therefore shows two unrelated runs and
the validation error is shown nowhere. `runReadOnlyPrompt` never pushes a
line, so both `.task-logs` files are empty and the agent's verdict cannot be
read back. `applyPrioritiseVerdict` writes the `Run order:` note only to ideas
whose position moved, and the route broadcasts only when something moved, so
an order the agent confirms as already right leaves its reasoning in a toast
and nowhere else.

**The task log keeps what the prompt returned.** `runReadOnlyPrompt` pushes
the agent's returned text as the task's lines (the full text goes to
`.task-logs/<id>.log`, the in-memory buffer keeps its last fifty lines) and,
on failure, the error text, so `/activity/task:<id>` shows the verdict or the
reason it was rejected. This applies to every read-only kind: commit-suggest,
overlap-check, prioritise, feedback, chat and desk-discovery.

**One task spans the retry.** `runReadOnlyPrompt(kind, prompt, title, {
task })` reuses an existing task when one is passed instead of registering a
new one. `getPrioritiseVerdict` takes a `runPrompt(prompt, retryReason?)`;
`agent.runPrioritise` opens the task once and binds both attempts to it. The
retry pushes `[retry] <validation error>` before the second attempt's output,
and the task finishes once, with the final outcome. The Stack panel and the
Activity list show one run per click.

**Every ranked idea gets its reason.** `applyPrioritiseVerdict` writes the
`Run order:` note to every id in the verdict, replacing that idea's previous
note, whether or not its position changed; `moved` keeps its meaning for the
toast. The route calls `activity.notifyChanged()` whenever a note or the order
was written. The toast still reads "Already in order" when nothing moved, and
the reasons are on the ideas.

Done when a click shows one "Prioritise queue" run whose page lists the
verdict (and the retry reason when there was one), and after a run that moves
nothing every active idea carries a fresh `Run order:` note.

### Phases
- [x] Read-only prompt output in the task log
      `runReadOnlyPrompt` pushes the returned text and errors; agent tests
      cover a success and a failure.
      run: 6m3s · 96 in · 25.7k out · sonnet-5 · sess:c9e5d16c-e17c-4288-9652-9707fa981a7f
- [ ] One task across the retry
      The `task` option, `runPrompt(prompt, retryReason?)`, `[retry]` line;
      `prioritise.test.ts` asserts one task for two attempts.
- [ ] Rank notes for every ranked idea
      Notes written for the whole verdict; broadcast whenever anything was
      written; tests for the unchanged-order case.
