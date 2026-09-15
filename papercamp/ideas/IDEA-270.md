---
id: IDEA-270
title: Review passes, not a night shift
type: refactor
status: idea
created: 2026-09-15
tags:
  - app
  - cli
  - server
subject: Run & monitor
order: 2
---

The shift [[IDEA-241]] built is named for a clock it does not keep. Its
gate is the desk being idle, the agent being free, and the rate-limit
windows having room — never the hour — so on 2026-09-15 it ran at 12:32
in the afternoon and filed 26 findings, and the settings that switch it on
still say *Night shift*, *Run the night shift for this project* and *Pause
tonight*. The name is the only thing that promises darkness, and it is the
one part that was never true.

**It is called Review passes.** Every user-facing string drops the night:
Settings → *Review passes*, its switch *Run review passes for this
project*, *Pause until the next reset*, *Run a pass now*; the Ideas page
group becomes *Review findings* with its date; the Log kind stays
`night-review` on disk, since renaming a persisted task kind would orphan
every row already written. The config block, the registry field, the
files, and the module names keep their `night` spelling for the same
reason — this is the vocabulary the user reads, not the schema.

**It runs only against code no pass has seen.** The gate gains one
condition: a chunk is reviewed only when its files have changed since the
commit that chunk was last reviewed at — `night.json` already stores
`lastReviewedCommit` per chunk, and `git diff --quiet <commit> -- <chunk>`
answers it. A pass that finds every chunk unchanged does nothing and logs
nothing, so a quiet afternoon costs no tokens and files no rows.

**And only when nothing else is running.** The existing gate checks the
machine's busy flag before a pass; it checks again between every check
within a pass, not only between chunks, and a pass whose chunk becomes
busy mid-flight stops after the check in flight rather than finishing the
list. A review must never sit alongside the work it is reviewing.

### Out of scope

The checks themselves and the health map. The clock window, which stays
an optional extra gate for anyone who wants one.

### Phases
- [ ] Skip chunks unchanged since their last review
      Filter chunk selection by `git diff --quiet <lastReviewedCommit> -- <chunk>` so a
      pass with nothing new does no work and writes no row.
- [ ] Re-check the busy flag between every check
      Fold `isMachineBusy` into the pass's per-check gate so a pass stops after the
      check in flight instead of finishing the chunk.
- [ ] Rename the strings the app shows
      Settings section and switches, the Ideas page finding group, and the critical banner.
- [ ] Rename the strings the CLI prints
      Command help, status lines, and errors — the `night` command name, config, and
      files keep their spelling.
- [ ] Update the tests and about.md to the new vocabulary
