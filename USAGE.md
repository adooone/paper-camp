# Using Paper Camp

Paper Camp is a local-first planning desk where you and coding agents share one
corpus. Ideas live as markdown files, agents execute the work in phases, and
git/GitHub carry the truth about what actually shipped. The app is a view and a
control surface — the files are the database.

## The corpus

Everything lives under `papercamp/` in your repo:

| File | What it is |
|---|---|
| `ideas/IDEA-N.md` | One entity per file: frontmatter (status, subject, order, tags) + body + `### Phases` checklist + `### Log` comments |
| `ideas/archive/` | Finished (done/dropped) entities, moved here on archive |
| `ideas/index.md` | Generated overview table — never hand-edit |
| `config.json` | Project config: id counters, subjects, per-task agent defaults |
| `decisions.md`, `open-questions.md` | Settled calls and unresolved questions, written mostly by agents |
| `progress.md` | Append-only changelog — every phase an agent finishes gets a dated entry |
| `suggestions.md`, `tasks.log` | AI idea inbox; machine record of every agent run |

Because it's all markdown in git, every change is reviewable, diffable, and
survives any tool — the app is optional at every step.

## The core loop

1. **Capture.** *New idea* on the Ideas page (or promote an entry from
   *Suggested from AI*, or add a note for planless thoughts). Ideas start as
   status `idea`.
2. **Refine.** Open the idea. *Extend* has an agent expand the one-liner into a
   reasoned body. Set its **Subject** (the epic-like grouping, managed in
   Settings) and its **run order** from the sidebar card. Discuss in
   **Comments**.
3. **Plan.** *Draft plan* has an agent write a `### Phases` checklist — small,
   independently-verifiable steps. The idea becomes `planned` and joins the run
   queue (the 1..N order stamps in the list gutter).
4. **Branch.** From the detail view, *Create branch* cuts
   `feat/idea-N-slug` from main — the app never switches branches on its own.
5. **Execute.** Run a single phase (▶ on the phase row) or *Run all phases*.
   The Stack panel shows each running task as its own card with live status —
   read-only tasks run in parallel; writers are gated so they can't collide.
   Checks (Quality / Tests / Consistency) gate every phase.
6. **Commit & push.** The Stack panel's Commit card lists changed files with a
   suggested conventional message (agents that finish work leave the message
   they want it committed under). Pushing a feature branch auto-creates a
   draft PR; it's promoted to ready when the plan reaches `review`.
7. **Review.** CodeRabbit reviews the PR. *Fix review* launches an agent that
   addresses each thread, resolves what it fixed on GitHub, and replies with
   reasons to what it declined. Approve and merge on GitHub.
8. **Land.** A merged PR derives the idea to *done* automatically (status is
   derived from reality — phases, branch, PR — not from stale frontmatter).
   From the dead branch, *Sync to main* stash-carries anything loose and
   fast-forwards. The idea appears in **Ready to archive** — one click moves
   the file to `archive/` and that's the human sign-off.

## The surfaces

- **Ideas** — the worklist: subject groups (handwritten headers), run-order
  stamps in the gutter, filters by status/tags, search, plus the AI-suggestion
  inbox and the archive queue below the list.
- **Idea detail** — phases with per-phase run/copy actions, progress bar,
  Comments; the sidebar card is the control surface: Status, Subject, Order,
  Agent, Tags, Actions (run all, fix review, approve & close, drop).
- **Stack panel** (right) — the machine room: running agent tasks (click one
  for its log), check stamps, and the git card (commit / push / sync / pull).
- **Tasks** — the run log, grouped by day: every agent invocation with timing,
  outcome, and expandable output. Survives restarts.
- **Docs** — this file and other repo docs, searchable.
- **Settings** — project identity, Subjects management, and which agent/model
  runs each task type.

## Beyond the app

- **CLI**: `paper-camp` mirrors the corpus operations (init, add, audit,
  PR sync) for scripts and CI.
- **MCP server**: agents connect directly — list plans, add ideas, log
  decisions — with the same guards the app enforces.
- **CI**: commitlint on every commit, quality/tests/consistency jobs, draft-PR
  automation, CodeRabbit review, release-please for versioning.

## Introducing someone

1. Clone, `pnpm install`, `pnpm dev`, then open `localhost:3333`
   (`gh auth login` first for the PR features).
2. Have them read this page in the Docs tab.
3. First exercise: capture a small real idea → *Extend* → *Draft plan* →
   *Create branch* → run one phase → commit from the Stack panel. One loop
   end-to-end teaches the whole model — everything else is variations.
