# Roadmap

## The goal

**A paper desk where one person directs a fleet of agents from idea to shipped
software — with a plain-markdown corpus as the only source of truth.**

Everything on this roadmap serves that sentence. The corpus stays diffable,
survivable, and tool-agnostic; the app stays the desk, not the database; agents
do the labor while every promotion that matters (plan → run → merge → archive)
stays a human decision.

## How this file works

The roadmap is the map; `papercamp/ideas/` is the queue. An item graduates by
becoming an idea (capture → subject → run order) through the normal flow, and
this file gets pruned when it does. Horizons are ordered by intent, not dates.

Items too big for one idea graduate differently: a **big bet** becomes a
**Subject**, and gets decomposed into a run-ordered sequence of ideas under it
— the same machinery that ships small things, aimed at a large one. The bet
stays on this map until its first idea is captured.

## Horizon 1 — Ready for daily use

The app works end-to-end for its author. This horizon makes it trustworthy for
a second person.

- **First-run experience** — `init` produces a welcoming empty corpus: seeded
  example idea, empty states that teach ("No ideas yet — capture one or ask for
  suggestions"), and USAGE.md surfaced on first open.
- **Packaging** — one command in any repo: scaffold `papercamp/`, start the
  desk. No cloning this repo to use the method. The runtime stays
  server-first: a local server owning files/git/agents, the browser as the
  client — no desktop shell unless tray/notification needs earn one later
  (see decisions.md, 2026-07-19).
- **Dev-server reload honesty** — server code changes silently don't apply
  until restart (the globalThis API cache). Either hot-reload routes or show a
  visible "restart needed" signal. This footgun bit three times in one week.
- **Error surfacing consistency** — every failure path reads as a one-line
  toast (git errors do now; agent-launch and config errors should match).
- **Review-queue hygiene** — the archive flow exists; adopt the habit loop it
  enables: nothing sits in `review` for more than a few days.

## Horizon 2 — A deeper desk

The loop works; make it smarter and more observable.

- **Goal & roadmap in the app** — this file rendered as a first-class surface:
  north star on top, horizons as groups, one-click "promote to idea" (the
  suggestion-promotion machinery already does 90% of this).
- **Insight from the task log** — `tasks.log` already records every run;
  surface cycle time per idea, agent success/retry rates, cost of a phase.
  The Tasks page becomes a dashboard, not just a log.
- **Ambient agents** — scheduled suggest sweeps, nightly audits, auto
  overlap-checks on capture: the corpus tends itself while you sleep, with
  everything they do visible in Tasks.
- **Richer review loop** — PR threads readable in the detail view, not just
  fixable; review state as part of the idea's story.
- **Notifications** — a phase finishing, a check failing, or a PR going green
  shouldn't require watching the Stack panel.

## Horizon 3 — Beyond one desk

- **Multi-project** — a workspace switcher over several corpora; one desk,
  many repos.
- **Collaboration** — the corpus is already git-shareable; add presence and
  merge-friendly conventions so two people (or one person and a remote fleet)
  can share a desk without stepping on each other.
- **Remote/hosted mode** — the desk reachable from anywhere (the Tailscale
  workflow, made first-class), agents running on a box that isn't your laptop.
- **Mobile control desk** — direct the flow from a phone: check the agent
  stack, approve/promote/archive, nudge a run. PWA over the existing
  responsive web app first (it already reaches phones via Tailscale), push
  notifications included; a native wrapper only if the PWA ceiling is hit.
  A big bet: graduates as a Subject, starting with responsive-polish ideas.
- **Project genesis** — Paper Camp as the starting point for new
  applications: scan an existing repo you like, distill its stack and
  conventions (checks, CI, style docs, structure) into a reusable template,
  then `init` new projects from it — corpus, guardrails, and scaffolding in
  one move. The scan is agent work; the template is part of the corpus
  format. A big bet: graduates as a Subject.
- **The format as the product** — document the corpus schema properly so other
  tools (editors, bots, dashboards) can read and write it. Paper Camp the app
  is one client of Paper Camp the format.
