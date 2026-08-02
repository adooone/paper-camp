---
id: IDEA-101
title: In-app sign-in via OAuth relay
type: feat
status: idea
created: 2026-07-26
updated: 2026-07-26
tags:
  - app
  - server
  - agent
---

[[IDEA-90]] and [[IDEA-86]] surface agent auth state and, when signed out, offer the fix as copy-me commands (`claude auth login`, `claude setup-token`). That was the deliberately-scoped "detect + surface + guide" cut, but the actual ask was to **sign in from the app** — a button, not a command to paste into a terminal. This is that follow-up, already flagged in IDEA-90's body.

The constraint, established from the CLI: both login paths are interactive by design. `claude auth login` opens a browser to authorize against the Claude subscription (no flag accepts credentials directly); `claude setup-token` likewise generates a token via browser auth. The server cannot silently log the user in — but it can drive the interactive flow so the user never touches a terminal.

The relay:
1. The server spawns `claude auth login` in a PTY (so the CLI runs interactively rather than seeing a non-tty and bailing).
2. It parses the CLI's output for the authorization URL.
3. The app shows a "Sign in" button/link (in the Stack auth prompt and the Settings Connections row) that opens that URL.
4. The user authorizes in the browser; the CLI receives the callback, writes credentials, exits.
5. The app polls `claude auth status` until `loggedIn: true`, then clears the signed-out state and lets the parked/failed run resume.

From the user's side: click a button in the app, authorize in the browser tab that opens, done — subscription preserved, no terminal.

Honest scope notes for the plan:
- The browser authorize step is inherent to OAuth and cannot be removed — the app makes it one click, it does not replace the browser. The only browser-free path is pasting an `ANTHROPIC_API_KEY` into Settings, which bills as API usage rather than the Max subscription and so is a poor default; keep it only as an explicit alternative, not the primary flow.
- Fragility: this depends on `claude auth login`'s interactive output format (the URL line), which can change between CLI versions. Parse defensively and fail gracefully back to the copy-command guide.
- Needs a PTY (e.g. node-pty) on the server, plus lifecycle handling: cancel/timeout the spawned login, one at a time, and clean up if the user navigates away.
- The copy-command remediation stays as the fallback for when the relay can't run (no PTY, offline, an agent CLI with no such flow) — decide whether the button replaces it outright when available or sits alongside it.
- Ties into [[IDEA-100]]: a run that parks because the agent is signed out should resume once this flow completes, rather than staying failed.

Provenance: 2026-07-26, after noticing the shipped auth remediation was copy-a-command, not the in-app login originally intended.

Placement (decided 2026-07-26 — auth is a global precondition, not a per-task outcome):
- **Home for the action: Settings → Connections.** The "Sign in" button lives on the agent's Connections row (next to git/gh), where services are connected. That is where you sign in *before* running work, not after something fails.
- **Ambient trigger: the StatusBar.** The existing "Agent not signed in" indicator ([[IDEA-86]]) stays as the always-visible signed-out warning, made **clickable** to jump to that Connections row (or launch the flow directly).
- **Not in the Stack agent card.** Today [[IDEA-86]] renders the "not signed in" state plus the copy-command remediation *inside a failed agent-task card*. That is the wrong home: it binds a global state to one task (the source of the false-auth bug fixed 2026-07-26, where a transient login blip mislabeled a gate failure as "signed out"), and it only appears *after* a run has already failed. **Change to make here:** pull the remediation out of the agent card (`agent-section.tsx` `AuthErrorFix` / the `errorKind === 'auth'` branch) — a failed task should at most read "stopped — agent signed out" as a reason with a link to the Connections sign-in, never host the sign-in commands or button itself.

### Phases
- [x] Spawn `claude auth login` in a PTY and parse the authorize URL
      Add node-pty on the server; run the login interactively, extract the URL line defensively, with cancel/timeout and one-login-at-a-time lifecycle.
- [x] Add the login-relay routes and store state
      Start/status/cancel endpoints under `/api/agent`; carry relay state (pending authorize URL, phase) into the agent store slice.
- [x] Poll `claude auth status` and resume parked runs
      Poll until `loggedIn: true`, clear the signed-out state, and resume the parked/failed run per [[IDEA-100]] instead of leaving it failed.
- [ ] Add the "Sign in" action to Settings → Connections
      Put the button on the agent's Connections row (next to git/gh) as the primary home — click opens the authorize URL in a browser tab.
- [ ] Make the StatusBar signed-out indicator clickable
      The always-visible "Agent not signed in" warning ([[IDEA-86]]) jumps to the Connections row or launches the flow directly.
- [ ] Pull the auth remediation out of the Stack agent card
      Remove `AuthErrorFix` / the `errorKind === 'auth'` branch from `agent-section.tsx`; a failed task reads "stopped — agent signed out" with a link only.
- [ ] Keep the copy-command guide as the graceful fallback
      Fall back to the paste-a-command remediation when the relay can't run (no PTY, offline, unsupported CLI); keep the `ANTHROPIC_API_KEY` path as an explicit alternative, not the default.
- [ ] Type-check and full pass
