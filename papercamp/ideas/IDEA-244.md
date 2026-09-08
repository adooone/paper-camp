---
id: IDEA-244
title: Record a run cut off by a crash
type: fix
kind: fix
status: idea
idea: IDEA-233
created: 2026-09-08
tags:
  - server
  - cli
subject: Multi-project
order: 12
---

A run-all launched for IDEA-243 on 2026-09-08 vanished without a trace when
the dev server crashed under it. `tasks.log` writes an entry only when a
task ends, and the task registry lives in the server's memory, so a task
in flight at the moment of a crash leaves nothing behind: no log entry, no
row in the Log, no stamp on the idea. After the restart the app showed the
idea as in progress with no agent running, and the only way to learn that
a run had been lost was to notice its absence.

**Every start is written down.** `agent.ts` appends a `started` record to
`tasks.log` when a task is registered — id, kind, plan, agent, `startedAt`
— and the finishing write becomes an update of that record rather than
the first mention of it. `readTaskLog` folds the two, so an entry with a
start and no end is a task that never finished.

**A restart names what it lost.** On boot the server reads the log, marks
every started-but-unfinished entry `outcome: 'interrupted'` with `endedAt`
set to the boot time and `reason: 'the server stopped while this task was
running'`, and emits an activity event for each. The Log shows them with
an `interrupted` outcome stamp in the warning colour, and the Stack panel
shows a one-line notice on the idea's card — "A run was interrupted;
run again" — until the next run on that idea starts. `paper-camp status`
under [[IDEA-233]] prints the same count when the daemon restarts.

### Phases
- [ ] Write the start record and fold it on read
      Append a `started` entry on task registration, update it on finish, and make `readTaskLog` merge the pair.
- [ ] Mark unfinished entries interrupted on boot and surface them
      The `interrupted` outcome in the Log, the notice on the idea's Stack card, and the count in `paper-camp status`.
