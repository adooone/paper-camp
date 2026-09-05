---
id: IDEA-239
title: Paint first, probe later
type: fix
status: idea
created: 2026-09-05
tags:
  - app
  - server
subject: App UI
order: 7
---

A refresh of the dashboard is an empty sheet of paper for most of ten
seconds — the background and nothing on it, no spinner, no skeleton, no sign
that anything is happening. The sheet is empty because nothing renders until
the client has asked the server a slow question, and then asks it again.

`main.tsx` will not mount React until `chooseProject` resolves, and for a
`paper-camp dev` origin that means `servesOwnRuntime`, which fetches
`/api/capabilities`. That route runs every plugin probe on each call — `gh
auth status`, `gh --version`, `git config`, `claude --version`, `opencode
--version` — with no cache, and timed against the running dev server it
answers in 3.3 s warm. The `opencode --version` probe alone takes 4.5 s on
this machine; `claude auth status` takes 1.4 s. `main.tsx` imports the
stylesheet before it awaits, so the paper paints the moment the bundle runs —
and then `<div id="root"></div>` sits empty on it until the answer arrives.

Then React mounts and the shell asks the same question twice more. `use-app-
shell.ts` fires `loadCapabilities` and `checkRuntimeReachable` on mount; the
second calls `servesOwnRuntime` again, so a second `/api/capabilities` round
trip runs while `runtimeChecking` is true, and during it `app-shell.tsx`
renders `null` in the content column. `loadPlans` and `loadIdeas` are gated
on that flag, so the list — which `/api/plans` answers in 18 ms — is the last
thing to appear. Blank window, then chrome with an empty page, then content:
three serial waits for one 18 ms list.

**First paint needs no network.** `main.tsx` mounts the router at once. The
self-served decision moves off `/api/capabilities` onto `/api/package-name`,
which answers in 1 ms, is JSON on a runtime and the SPA's HTML on a static
host, and — once [[IDEA-235]] lands — a JSON 404 at a daemon root; the same
parse-as-JSON verdict `servesOwnRuntime` already trusts. The probe runs once,
its verdict is stored in the runtime slice, and `checkRuntimeReachable` reads
that instead of probing again. The hub redirect for a hosted bundle happens
when the verdict says so, from the app, with the boot indicator on screen in
the meantime rather than an empty sheet.

**Probes are cached on the server.** `probeCapabilities` and
`probeConnections` memoise their results for the life of the process. The
cache is dropped by the Settings recheck, by `runConnect`, and by the sign-in
relay's `onLoginConfirmed`, which is also when `probeAgentAuthStatus`'s cached
answer expires. Version probes (`--version`) get a 2 s timeout in `run.ts`;
the 5 s default stays for everything else. A tool that takes longer than two
seconds to print its version is reported as slow, not awaited.

**The list loads with the shell.** With the verdict known at boot,
`loadPlans` and `loadIdeas` fire on mount alongside the other loads instead
of waiting on `runtimeChecking`, and the content column renders the route's
skeleton — `PlansListSkeleton` for Plans, a row skeleton of the same shape for
Docs, Roadmap, Tasks, and Settings — wherever it renders `null` today.
`RuntimeUnavailable` appears only after a verdict of unreachable, never
during the check.

**Something is always moving.** The paper is never bare while the app is
working. `index.html` ships a boot indicator inside `#root` — paper-ui's
spinner drawn as inline markup with a "Setting up camp…" line under it,
centred in the window, on the same paper background the stylesheet will
apply (its value already sits in the page's `theme-color` meta). It is on
screen from the first byte of HTML, through the bundle load, and until React
mounts and replaces it. From then on the shell's chrome is visible and the
content column is never empty: a route with a skeleton shows the skeleton,
and a route without one shows the same spinner with the route's name under
it, until its data answers. A spinner that is still there after ten seconds
gains a second line — "Still checking the tools on this machine…" — so a slow
probe reads as slow rather than broken.

### Out of scope

Vite's dev-server module transform on a cold reload, which is the remaining
cost in `pnpm dev` and does not exist in the built app. Any change to what
the probes check or to the Settings connection rows. The Stack panel's own
loads.
