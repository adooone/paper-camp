---
id: IDEA-128
title: In-app dev toolbar — paper-camp living inside the target application
type: feat
status: idea
created: 2026-08-05
updated: 2026-08-05
tags:
  - integration
  - app
subject: In-app dev toolbar
---

Owner's idea: integrate paper-camp natively into the application being built. When the target app's dev server runs, paper-camp is present *inside it* — a **docked toolbar** (Vercel-Toolbar-style) wired to the corpus and tools, a link out to the full desk, and optionally the whole desk mounted on a subroute of the app.

Prior art proves the pattern (Vercel Toolbar, Nuxt DevTools, React Query Devtools) — but none of them are a project brain. The differentiated loop is **capture-in-context**: you notice something while clicking through your own app, hit capture on the toolbar, type two sentences, and the idea lands in the corpus with the current route/URL attached.

Shape:

- **Reuse the desk's existing StatusBar** (`src/app/components/shell/status-bar.tsx` — "ambient status + immediate quick actions") rather than building a new component. Extract it into a shareable toolbar with two mounts: the desk shell as today, and the target app via the plugin. It already wires agent status, git state, quick commit, and setup gaps to the server API.
- In-app mount adds the app-specific segments: current focus (active idea/phase), quick capture with route context, parked-questions badge ([[IDEA-118]]), check/run status once [[IDEA-119]] lands, "open full desk" link. Docked to the bottom edge, collapsing to a pill when idle; segments expand into small panels above the bar.
- `@dendelion/paper-camp/vite` plugin, dev-only by default: injects the toolbar (shadow-DOM web component — framework-agnostic, immune to host CSS) and mounts the desk at `/__camp` via middleware proxying to the paper-camp server (`config.port`), which also avoids CORS by staying same-origin.
- Config: an `integration: { toolbar, route }` block in `papercamp/config.json` (the declarative-manifest direction), toggleable in Settings for frontend targets.
- **Not** on production URLs by default — corpus + agent controls in a deployed app is a security footgun. Remote access belongs to Horizon 3's remote/hosted mode; the toolbar links there instead of embedding. Opt-in + authed for internal deployments at most.
- Non-Vite consumers later via thin adapters (any dev server that can proxy).

Blocked until the StatusBar isolation ([[IDEA-129]]) lands — the toolbar builds on its extracted core.

## Toolbar contents & access model

Organizing rule (inherited from the StatusBar's own charter): ambient status + immediate quick actions; the desk remains the full control surface. Three interaction tiers, strictly enforced — **glance** (always visible: status light, focus, badges), **quick action** (one click/keystroke, optimistic, toast-confirmed), **deep work** (anything deeper deep-links into the desk / `/__camp`). The toolbar never grows a workflow.

Write-safety rule: the toolbar gets only the safe verbs — capture, reply, quick commit, run next phase, stop run. Structural operations (archive, plan edits, settings, subjects) stay desk-only, so an embedded surface can never reorganize the corpus.

Segments, left → right:

1. **Focus** — active idea + current phase (the existing session-focus data). Panel: read-only phases + open-idea link.
2. **Scout** — the conversational agent, extracted to its own idea: [[IDEA-130]] (Paper Scout — thread-verbatim chat, questions inbox folded in, capture as a chat capability, distillation). The toolbar mounts Scout; its glance state is the project-wide parked-questions badge, top-level on the bar.
3. **Runs** — live agent indicator (kind + plan), recent task outcomes, one-click stop.
4. **Ship** — the StatusBar heritage: branch, ahead/dirty, check stamps, quick commit.
5. **Desk** — open the full desk; every panel also deep-links to its full view.

Per-project trimming via `integration.toolbar.segments` allowlist in config.json. Delivery phases: **v1 is read-only + links** (Focus, Desk, glance badges — no writes, no agent controls), v2 Scout ([[IDEA-130]]), v3 Runs/Ship.

### Phases
- [ ] Scaffold the `@dendelion/paper-camp/vite` plugin
      Dev-only plugin that injects the toolbar and proxies `/__camp` to the paper-camp server on `config.port`.
- [ ] Mount the extracted StatusBar as a shadow-DOM web component
      Framework-agnostic bar docked to the bottom edge, collapsing to a pill when idle; segments expand into panels above it.
- [ ] Wire the `integration` config block and Settings toggle
      `integration: { toolbar, route }` in config.json with a `toolbar.segments` allowlist, toggleable for frontend targets.
- [ ] Ship v1 segments — Focus, Desk, glance badges
      Read-only only: session focus, open-desk link, and badge counts with no writes or agent controls.
- [ ] Add the v2 segment — mount Paper Scout
      Consume [[IDEA-130]]'s chat surface in the toolbar: project-wide questions badge on the bar, panel with the Scout thread and route context injected.
- [ ] Add v3 segments — Runs and Ship
      Live agent indicator with stop, run-next-phase, plus branch/check stamps and quick commit.
- [ ] Enforce the dev-only production guard
      Keep the toolbar off production URLs by default; link to remote/hosted mode instead of embedding.

### Log
- 2026-08-05 — Decision (owner): toolbar form factor over the corner icon-bubble — a docked bar with segments, Vercel-Toolbar-style.
- 2026-08-05 — Decision (owner): reuse the desk's existing StatusBar as the base — one toolbar component, two mounts (desk shell + injected in-app), not a parallel implementation.
- 2026-08-05 — Design session: segments (Focus / Capture / Questions / Runs / Ship / Desk), three-tier access model (glance → quick action → deep link), safe-verbs write rule, per-project segment allowlist, v1–v3 delivery phasing. See "Toolbar contents & access model".
- 2026-08-05 — Decision (owner): v1 is read-only + links — no capture form, no run controls. The capture segment is replaced by an agent Chat (the existing Feedback chat surfaced in-app); capture becomes a chat capability.
- 2026-08-05 — Decision (owner): chat is thread-verbatim — chat messages are corpus thread messages of a new collapsible `chat` kind, with first-class distillation (promote outcomes to decision/idea/log; auto-summary when a session goes quiet). No session-style side channel.
- 2026-08-05 — Decision (owner): Questions folds into Chat — one segment, five total. The questions badge stays top-level on the bar and counts open questions project-wide; the panel triages oldest-first, grouped by idea.
- 2026-08-05 — Decision (owner): the chat extracted to its own idea and named **Paper Scout** ([[IDEA-130]]) — unifying with the existing Scout GitHub App identity. This idea keeps the toolbar shell and mounts Scout as its v2 segment.

### Thread
- [x] 2026-08-05 [question] [agent] Chat segment design is open: does the toolbar chat reuse the per-idea Feedback thread verbatim (thread = chat history), or get its own session-style thread that files notes/ideas into the corpus as side effects? And does Questions stay a separate segment or fold into Chat once parked questions render in the same thread surface? → Resolved by owner decisions in the Log: thread-verbatim with a collapsible `chat` kind + distillation; Questions folds into Chat with a top-level project-wide badge.
