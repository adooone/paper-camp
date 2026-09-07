# Using Paper Camp

Paper Camp is a local-first planning desk where you and coding agents share one
corpus. Ideas live as markdown files, agents execute the work in phases, and
git/GitHub carry the truth about what actually shipped. The app is a view and a
control surface — the files are the database.

## The corpus

Everything lives under `papercamp/` in your repo:

| File | What it is |
|---|---|
| `ideas/IDEA-N.md` | One entity per file: frontmatter (status, subject, order, tags) + body + `### Phases` checklist + `### Thread` messages |
| `ideas/archive/` | Finished (done/dropped) entities, moved here on archive |
| `config.json` | Project config: id counters, subjects, per-task agent defaults |
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
   reasons to what it declined. Approve and **squash-merge** on GitHub — one
   commit per idea lands on `main`, titled from the idea (the per-phase
   commit history stays on the PR and in this idea's own log).
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
- **Projects hub** — the registry of every project this browser knows, with
  cross-project tabs; *Back to projects* in the header opens it. See "The
  hub" below.

## Beyond the app

- **CLI**: `paper-camp` mirrors the corpus operations (init, add, audit,
  PR sync) for scripts and CI, plus a machine-level project registry
  (`scan <dir>`, `ls`, `rm <slug>`, `daemon`) at `~/.config/paper-camp/`.
  Set `PAPERCAMP_CONFIG_DIR` to point that registry at a different
  directory — a second, separate set of projects, or a throwaway daemon
  that never touches your real one.
- **MCP server**: agents connect directly — list plans, add ideas, log
  decisions — with the same guards the app enforces.
- **CI**: commitlint on every commit, quality/tests/consistency jobs, draft-PR
  automation, CodeRabbit review, release-please for versioning.

## Installing into your own project

Paper Camp ships on npm and installs once per machine, not once per repo:

```bash
npm install -g @dendelion/paper-camp
paper-camp scan ~/dev
paper-camp start
```

`~/dev` stands for the folder holding your repositories — `scan` registers
every one under it that already has a `papercamp/` corpus; `paper-camp init`
run inside a single repo scaffolds that corpus and registers just that one
repo, with no `scan` step. `start` launches the daemon detached, logging to
`daemon.log` in the machine config dir, and prints a **Local** link to open.
Reaching it from the hosted client on another device needs `paper-camp start
--tailnet` instead — see "Adding a project" below.

`init` also creates the `.claude/` integration (a paper-camp skill plus
session hooks) in the repo it runs in. For the full loop you also want `gh
auth login` (PR features) and a coding agent CLI (`claude` or `opencode`) on
PATH.

Upgrading later is a normal global dependency bump — `npm update -g
@dendelion/paper-camp` — check `paper-camp --version` against the
[changelog](CHANGELOG.md) if you want to confirm what shipped since you last
bumped it.

Prefer a single repo running in the foreground instead of the detached
daemon? `paper-camp dev`, run inside that repo, serves just it in the
terminal you started it from.

Working on Paper Camp itself is the clone path instead: `pnpm install`,
`pnpm dev`, open `localhost:3333`.

## The hub — every project in one place

The hub is the `/projects` view of the same app: the registry of your projects
plus the cross-project tabs — **Projects**, **In review**, **Agent activity**,
**Ideas**. It lives in two places:

- **The hosted client** at `https://paper-camp.vercel.app` — a static build
  with no project of its own, so it opens straight into the hub. Every Network
  link `paper-camp start` (or `dev`) prints points here, which is what lands
  all your projects in this one registry.
- **Any running dashboard** — *Back to projects* in the header opens that
  server's own hub at `/projects`.

The registry is the browser's localStorage at that origin: a project added in
your laptop's hosted client is not in your phone's — open its link once there
too.

### Adding a project

1. On the machine holding your repositories, run the three commands above:
   `npm install -g @dendelion/paper-camp`, `paper-camp scan ~/dev` (or
   `paper-camp init` inside a single repo), then `paper-camp start`. The
   banner prints a **Local** link (the dashboard on this machine) and a
   **Network** link (the pairing link for other devices).
2. Open the **Local** link on that same machine and the hub lists its
   registered projects first, under **This machine** — the page's own origin
   answers its own `/api/machine/projects`, so nothing needs pairing. From a
   different device, open the **Network** link instead: it carries the
   daemon's address and a pairing token, so one visit both registers the
   machine and pairs the client with it. The hosted client is HTTPS, so it
   can only fetch an HTTPS runtime — pairing from another device needs
   `--tailnet` or `--share`; without one, the banner prints that requirement
   in place of a Network link.
3. Click a project's row to enter it; *Back to projects* returns to the hub.
   Rows can be renamed and removed — removing only forgets the address, never
   anything in the repo.

The pairing token persists in `~/.config/paper-camp/pairing.json`, so a
hosted client paired once stays paired across `paper-camp start` restarts —
Local, LAN, and tailnet origins never needed it anyway, since network
topology already vouches for them. To revoke every paired client, delete
that file: the next start mints a fresh token and forgets every paired
origin.

Other ways in:

- **A machine the hub already knows**: once a `?machine=` link has been
  opened, that machine's not-yet-added projects sit in their own card,
  ready to add — one click, no repeat trip to the terminal.
- **`paper-camp start --share`** prints a Tunnel link — the hosted client can
  reach that machine across the open internet. The address changes every
  restart.
- **`paper-camp start --tailnet`** serves over HTTPS at a stable
  `https://<node>.<tailnet>.ts.net` address and prints that link — no token
  needed, since a tailnet origin is already trusted. See "On your tailnet"
  below.

Each row's stamp says what the hub can do right now: **Can execute** (the
runtime answers), **Offline** (it doesn't), or **Version mismatch** (runtime
and client differ — update one side).

### On your tailnet

If every machine involved already runs Tailscale, `paper-camp start
--tailnet` is the fastest way in — no pasted link, no tunnel:

```bash
paper-camp start --tailnet
```

It runs `tailscale serve --bg --https=443` for you, then prints the
`https://<node>.<tailnet>.ts.net` link straight in the banner — open it from
any device on the tailnet and it just works, no pairing token needed at all:
a `.ts.net` origin is trusted the moment it's reached, the same as loopback
or a LAN address, because network topology already vouches for it. On a
personal tailnet that's exactly right; on a shared one it means every
member's device is trusted by the runtime, worth knowing before you add
people to it. If your tailnet hasn't turned on HTTPS certificates yet, the
banner says so and links straight to the
[admin console](https://login.tailscale.com/admin/dns) setting that turns it
on — `README.md` keeps the manual `tailscale serve` steps as a fallback.

A tailnet peer becomes known to the hub the same way any other machine
does — open its Tailnet link once.

**Mobile:** open the `https://…ts.net` link on a phone joined to the same
tailnet, then install it to the home screen (`Add to Home Screen` on iOS
Safari, `Install app` on Android Chrome) — that installed PWA is the mobile
story; there's no native app.

## Introducing someone

1. `npm install -g @dendelion/paper-camp` on a machine of theirs (or yours),
   then `paper-camp scan ~/dev` (or `paper-camp init` in a single repo) and
   `paper-camp start`.
2. Have them read this page in the Docs tab.
3. First exercise: capture a small real idea → *Extend* → *Draft plan* →
   *Create branch* → run one phase → commit from the Stack panel. One loop
   end-to-end teaches the whole model — everything else is variations.
