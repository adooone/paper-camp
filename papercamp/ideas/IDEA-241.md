---
id: IDEA-241
title: Night shift health reviews
type: feat
status: idea
created: 2026-09-07
tags:
  - cli
  - server
  - app
subject: Run & monitor
order: 4
---

Most days end with Claude capacity unspent. The five-hour window resets
twice overnight and the seven-day window rarely runs dry, so the limit that
was paid for sits idle exactly when nobody is at the desk. Meanwhile the
supportive work — the bug hunt nobody schedules, the dead code that
accumulates, the tests that were never written for last week's churn — waits
for a human to notice it.

The daemon is a process that stays up on a machine that stays up, and every
agent run already returns a rate-limit snapshot with both windows'
utilisation and reset times. Those two facts make an unattended shift
possible: reviews that run only when the desk is idle and the budget has
room, aimed only at the code that needs them, reporting into the inbox the
morning reads anyway.

**One project, chosen on the machine.** The night shift runs for exactly one
registered project: the one in active development. `projects.json` gains
`night: { slug }`; `paper-camp night <slug>` sets it, `paper-camp night off`
clears it, `paper-camp night status` prints the gate, the next chunks, and
last night's totals. The same choice is a toggle in that project's Settings
— "Run the night shift for this project" — which writes the registry
through the daemon's machine endpoint. Only `paper-camp daemon` runs the
shift; `dev` never does.

**The gate.** A pass starts only when every condition holds: no dashboard
request for thirty minutes, no agent task running, the last snapshot's
five-hour utilisation at or below the ceiling, and its seven-day utilisation
at or below the floor. Defaults are 50% and 70%; both live in
`papercamp/config.json` under `night`, with an optional local-time window
(`from`, `to`) for people who want a clock as well. The shift stops the
moment a condition flips, checking the snapshot each pass returns, and never
starts a pass that would breach the floor. The seven-day floor is the one
that protects the working week and is the setting to tune first.

**A health map picks the targets.** Chunks are the top-level folders under
`night.roots` (default: every folder one level under `src/`). For each
chunk the daemon derives a health score from churn (commits touching it in
the last thirty days, from `git log --numstat`), size (lines), coverage (from
`coverage/coverage-summary.json` when present, unknown otherwise), open
findings from earlier nights, and days since the chunk was last reviewed.
High churn, low coverage, large size, and a long gap all raise the score.
The map and each chunk's last-reviewed commit persist in
`papercamp/night.json`. A night reviews at most `night.maxChunks` (default
three) chunks, highest score first, and only chunks above `night.threshold`
— healthy code is left alone. The Stats page gains a *Code health* card
listing every chunk with its score, its signals, and when it was last
reviewed, so the map is visible by day.

**Checks, built in and custom.** Each pass is one check against one chunk.
Built-in checks, each a prompt template fed the chunk's file list and its
diff since the last review: `bugs` (logic and edge cases), `dead-code`
(unused exports, unreachable branches, duplicated helpers), `performance`
(hot loops, repeated I/O, unbounded growth), `tests` (behaviour without a
test, tests that assert nothing), `docs` (comments and docs that contradict
the code), `security` (injection, unvalidated input, secrets), `a11y`
(missing labels, focus traps, contrast). Settings → *Night shift* lists them
with an on/off each, and holds `night.customChecks`: a name and a prompt
body per entry, run the same way. `defaultAgents.nightShift` chooses the
agent, model, and effort like every other task kind; the default is the
`phase` agent on sonnet at medium effort.

**Passes are read-only and capped.** Every pass runs in a temporary git
worktree checked out at the reviewed commit and removed after the night, so
nothing an agent does can touch the working tree, with Edit, Write, and
NotebookEdit disallowed on top. Each pass has a turn cap and a cost cap from
`night`; a finding is kept only if a second, short pass on the same agent
confirms it against the file. Findings that match an open idea or an
earlier finding by file and message are dropped; the overlap check already
does this for suggestions.

**Findings are suggestions, reported by night.** Each confirmed finding is
written to `papercamp/suggestions.md` with `source: night`, the check, the
chunk, the files, the reviewed commit, the confidence, and the date. The
Ideas page shows them above the ordinary AI suggestions in a *Night report*
group per date with its pass count and cost; promote makes an idea, dismiss
drops it, and a finding whose files changed after its commit expires on
read. Each pass is a Log row of type `night-review` with its cost, and the
night's total appears in the Log's stats like any other run.

**Findings are hard to miss.** The confirming pass assigns each finding a
severity from a fixed rubric: `critical` for data loss, a security hole, or
a crash on a main path; `high` for a wrong result the user would see;
`normal` for everything else. On the Ideas page the *Night report* group
sits above every other group, including the run queue, and each finding
row carries a `night` stamp and a severity stamp in the night palette —
the slate accent that paper-ui's Card and Stamp already expose, which no
other row uses, so a night finding reads as one from across the room. The
group's header shows the counts by severity. A critical finding also raises
a banner across the top of every project page, in the shell where the
server-reload banner lives, naming the finding and linking to it; the banner
stays until that finding is promoted or dismissed, and one banner covers
all critical findings when there are several. Any colour this needs that
paper-ui does not have is added to paper-ui first, as a `--pui-*` token,
never hardcoded here.

**Controls.** Settings has the toggle, a *Pause tonight* switch that clears
at the next reset, and *Run a pass now*, which runs the highest-scoring
chunk against the enabled checks immediately, gate or not.

### Out of scope

Fixing anything at night; the shift reports and the morning decides. More
than one project per machine. Running under `paper-camp dev`. Surviving a
reboot, which is [[IDEA-233]]'s later concern.

### Phases
- [x] Pick the project and read the settings
      Add `night: { slug }` to `projects.json` with `paper-camp night <slug> | off | status`, and the `night` block in `papercamp/config.json` with its defaults.
      run: 8m30s · 100 in · 31.1k out · sonnet-5
- [x] Score the chunks into a health map
      Derive churn, size, coverage, open findings, and last-reviewed age per chunk into `papercamp/night.json`, and show it as the Stats *Code health* card.
      run: 13m22s · 142 in · 51.8k out · sonnet-5
- [x] Gate the shift in the daemon
      Idle desk, no running task, both rate-limit windows, and the optional clock window, rechecked after every pass.
      run: 14m27s · 176 in · 53.6k out · sonnet-5
- [x] Run a pass read-only
      Built-in and custom checks against one chunk in a throwaway worktree, with Edit/Write/NotebookEdit off, turn and cost caps, and a confirming pass that assigns severity.
      run: 28m37s · 340 in · 141.4k out · sonnet-5
- [x] Report findings as night suggestions
      Write confirmed findings to `papercamp/suggestions.md` with `source: night`, drop overlaps, expire stale ones on read, and log each pass as `night-review`.
      run: 20m56s · 276 in · 89.5k out · sonnet-5
- [ ] Surface the night report on the Ideas page
      A dated *Night report* group above every other group, night and severity stamps, and a shell banner for critical findings.
- [ ] Add the Settings controls
      The per-project toggle, the check list with custom checks, `defaultAgents.nightShift`, *Pause tonight*, and *Run a pass now*.
