---
id: IDEA-236
title: Real agent errors and sign-in that completes
type: fix
status: idea
created: 2026-09-05
tags:
  - app
  - server
subject: Run & monitor
order: 1
---

Suggest commit message failed today with a notice reading "Ignoring 14
permissions.allow entries from .claude/settings.json…". That line is a
warning, not the failure. Reproducing the exact headless call the runner
makes — `claude -p --output-format json` with the prompt on stdin — exits 1
with the real reason on **stdout**, inside the JSON:

```
{"type":"result","is_error":true,
 "result":"Failed to authenticate: OAuth session expired and could not be refreshed"}
```

Stderr carries only the trust warning. `runReadOnlyPrompt` in `agent.ts`
surfaces stderr on a non-zero exit and never reads the result, so the user
sees the noise and not the cause. The streaming runner's close handler does
the same for phase runs, and its auth classification is a string match on
`Not logged in · Please run /login` — a message the CLI no longer prints, so
a signed-out agent no longer parks the task with `errorKind: 'auth'` and the
"stopped — agent signed out" stamp never appears.

Signing in from the app is the remedy, and it does not complete either.
`claude auth login` under the relay's pseudo-terminal (2.1.250, headless
Linux) prints the link inside an OSC 8 hyperlink and then waits at `Paste
code here if prompted >`:

- `stripAnsi` handles CSI sequences only, so the captured link ends in
  `…&state=<value>;;` — the hyperlink terminator glued onto the OAuth
  state. Verified against the real output. The browser tab opens with a
  corrupted state parameter.
- Nothing ever writes a code to the pty. After the user authorizes, the CLI
  sits at the paste prompt until the five-minute session timeout and the app
  reports "Sign-in was not completed in time".

**The result text is the error.** Both runners parse stdout for the `result`
line and, when `is_error` is set, surface its `result` text as the task's
error and the route's message. Stderr is the fallback when stdout has no
result, minus the `Ignoring … permissions.allow entries` notice, which is
kept in the task log but never shown as the failure. The exit code is the
last resort, as today.

**Signed-out is detected by asking, not by matching.** When a run ends in
error, the runner calls `claudeAuthStatus` and sets `errorKind: 'auth'` when
`loggedIn` is false — the same probe the relay already uses to confirm a
sign-in. The string marker is deleted. Read-only prompts get the same
classification: `/api/git/suggest-commit-message` answers `{ error, kind:
'auth' }`, `git-api.ts` throws an error carrying `kind`, and
`commit-message-fields.tsx` renders a **Sign in** action beside the message
when it is an auth failure. `SignInAction` and `RelayFallbackGuide` move from
`features/settings/components` to `src/app/components/` so the git card and
the Settings row render the same control. The agent card's stamp keeps
navigating to Settings.

**The relay strips OSC and answers the code prompt.** `stripAnsi` also
removes operating-system-command sequences (`ESC ]` up to a BEL or `ESC \`
terminator) before the URL match, and `login-relay.test.ts` gains a fixture
taken from the real 2.1.250 output. When the buffer shows `Paste code here`,
the relay sets `needsCode: true` on `LoginRelayState`; the client renders a
code input with "Paste the code the sign-in page shows" beside *Reopen
sign-in tab* and *Cancel*, and `POST /api/agent/login-relay/code` writes the
code followed by a carriage return to the pty. Exit 0 still means success and
still polls `auth status` before resuming parked tasks. When the CLI
completes through its own localhost callback, `needsCode` stays false and
nothing changes.

**The trust warning gets its own row.** The Claude Code connection in
Settings probes `~/.claude.json` for `projects[<root>].hasTrustDialogAccepted`
and, when it is not `true`, shows a warn stamp — "Headless runs ignore this
repo's permission allowlist" — with the remedy: open `claude` in the repo
once and accept the trust dialog. Paper Camp does not write that file.

### Out of scope

Any change to what the allowlist grants ([[FEAT-10]]). opencode's auth
flow. Rotating or storing credentials on Paper Camp's side; the CLI keeps
its own.

### Phases
- [x] Read the failure from the result line
      Have both runners parse stdout for the `result` JSON and surface its text, falling back to stderr minus the `Ignoring … permissions.allow entries` notice, then the exit code.
      run: 1m4s · 24 in · 2.7k out · sonnet-5
- [ ] Classify signed-out by probing auth status
      Call `claudeAuthStatus` when a run ends in error, set `errorKind: 'auth'` on `loggedIn: false`, and delete the `Not logged in · Please run /login` string match.
- [ ] Carry the auth kind to the git card
      Return `{ error, kind: 'auth' }` from `/api/git/suggest-commit-message`, throw it through `git-api.ts`, and render a **Sign in** action in `commit-message-fields.tsx`.
- [ ] Move the sign-in controls to shared app components
      Relocate `SignInAction` and `RelayFallbackGuide` into `src/app/components/` so the git card and the Settings row render the same control.
- [ ] Strip OSC sequences before matching the login URL
      Extend `stripAnsi` to drop `ESC ]` … BEL/`ESC \` sequences and add a `login-relay.test.ts` fixture from the real 2.1.250 output.
- [ ] Answer the paste-code prompt from the app
      Set `needsCode` on `LoginRelayState` when the buffer shows `Paste code here`, render the code input beside the existing actions, and write the code plus a carriage return to the pty from `POST /api/agent/login-relay/code`.
- [ ] Warn when the repo's trust dialog was never accepted
      Probe `~/.claude.json` for `projects[<root>].hasTrustDialogAccepted` and show a warn stamp with the remedy on the Claude Code connection row.
