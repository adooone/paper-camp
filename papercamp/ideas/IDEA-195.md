---
id: IDEA-195
title: Global client, local runtime
kind: board
created: 2026-08-19
updated: 2026-08-21
tags:
  - architecture
  - research
subject: Multi-project
order: 8
---

The settled architecture for Paper Camp as a hosted client driving work on the
user's own machine. Collects what [[IDEA-117]] and [[IDEA-193]] rest on, so
neither has to restate it. ([[IDEA-192]] drew on it too and has since shipped.)
Every question this note opened is now answered; what remains below is work, not
research.

### Settled

**Nothing is hosted on the user's behalf.** Paper Camp publishes a UI and a
package. No server, no accounts, no corpus storage, no relay it operates. The
client is a static bundle on a CDN: it holds no data and runs nothing.

**The client is hosted, and that is the front door.** You open a URL. Nothing is
installed to see your work. Installing the package is what adds execution, not
what grants access.

**Execution stays on the user's machine, on the user's plan.** The agent CLI is
already authenticated and already paid for there. This is the constraint that
costs the most and it was chosen deliberately over the alternative below.

**Git is the database.** The corpus stays per-repo, as [[IDEA-117]] settles.
Centralize the lens, never the data.

**Three layers.** A thin client that collects intent and decides nothing; a
runtime that owns the filesystem, git, the agent and the checks; plugins that
reach other systems. Plugins are two kinds with different trust boundaries —
*external services* the runtime speaks to (GitHub via an authenticated `gh`) and
*local adapters* it drives (`claude-code`, `opencode`, already pluggable).

**The runtime is reached over loopback.** The hosted https client talks to
`http://localhost:PORT`. Loopback is a potentially trustworthy origin, so the
mixed-content rule that blocks every other http target does not apply to it. This
is the front door and it is not revisited. What it costs is engineering, not a
decision: Private Network Access requires the runtime to answer the preflight a
public origin sends before reaching a local one, and its own responses must carry
CORS headers they do not carry today. Both are phases on [[IDEA-193]].

**Working without a runtime is a first-class state, not a degraded one.** With no
runtime reachable the client still does the whole planning half of the product —
read the corpus, write ideas, order the queue, review — by talking to GitHub
itself. Only execution needs the local machine: agent runs, git operations,
checks, the filesystem. A project with no runtime is not broken, it is plan-only,
and it can stay that way indefinitely.

**The client holds a GitHub credential, and the principle says so.** Plan-only
requires it, so "the client holds nothing" is rewritten rather than quietly
broken: the client holds no corpus, no account, and no credential it did not
obtain directly from the user's own authorization. A fine-grained GitHub token
the user mints and pastes in, kept in device-local storage, is exactly that — no
backend holds it, and no Paper Camp service ever sees it.

Device flow was the obvious mechanism and it does not work: `github.com/login/*`
sends no CORS headers and 404s the preflight, so the exchange needs a server-side
hop, and a hosted shim is the backend this architecture refuses. `api.github.com`
is CORS-enabled, so only acquisition was ever blocked. A minted token also grants
less than an OAuth flow would — chosen repositories only, revocable at will.

**One app, capability-aware modules.** The no-runtime experience is the same app
with its modules reporting what they can do, not a separate reduced build. A
module that needs the runtime says so in place and stays visible; a second
codebase would drift from the first and double the surface. Every module declares
which layer it needs, and the client composes from what is actually reachable.

**Local hosting stays.** `paper-camp dev` serving the app from inside a repo,
with the in-app toolbar, remains fully supported alongside the hosted client. It
is the same bundle from a different origin, it needs no transport work at all,
and it is what a contributor or a CI box uses.

**One runtime per repository.** The runtime stays what [[IDEA-193]] settles it
is — a dev dependency of the repo it serves — and the client fans out across as
many as the user registers. Everything a runtime does is already repo-scoped: it
shells `git`, `gh` and the agent binary with the repo as cwd and runs that repo's
own checks, so one runtime managing many would still fork per-repo subprocesses,
and would additionally force a single paper-camp version on every project — the
skew [[IDEA-168]] exists to tolerate. [[IDEA-117]]'s promise was one desk, not
one process; N ports become registry detail the user never sees.

**The registry is device-local.** The client keeps the list of runtime URLs in
browser storage, per device — connection state, not data. A desk repo in git
would sync across devices but needs a runtime to read the registry that says
where the runtimes are; probing for whatever answers stores nothing but makes an
offline project vanish, when knowing it exists is the point of a hub.

**Projects are registered, never discovered by scanning.** Folder scanning from
[[IDEA-117]] is dropped: a repo-scoped runtime has no business reading disk
outside its repo, and a client cannot read disk at all. A project enters the
registry when its runtime announces itself — `paper-camp dev` prints a
registration URL — or, when it has no runtime yet, through GitHub import. The
registry holds both kinds of entry, and a project whose runtime is unreachable is
shown as plan-only rather than hidden.

**Two-step onboarding.** Step one: the hosted app connects GitHub repos and
installs the methodology — docs, config, corpus — via a PR. Usable with no AI and
no install. Step two: install the local package to add execution. Step one needs
nothing from the transport work, which is what makes this sequence valuable.

### Measured, not assumed

Spiked 2026-08-19 against a real browser, after two confident predictions about
browser behaviour proved wrong.

- **A hosted https client cannot reach a plain-http runtime on a non-loopback
  address.** The request never left the browser — the target's access log stayed
  empty even with `mode: 'no-cors'`, which bypasses CORS entirely. Mixed content,
  and no server-side change moves it. This is why loopback, which is exempt, is
  the only address the client ever dials.
- **Cross-origin http→http works; CORS is a small fix.** The request arrived and
  was answered; only the response was hidden. The preflight already returns
  `Access-Control-Allow-Origin: *` from Vite's middleware while the API's own
  responses carry no CORS headers.

### Rejected, and why

**Running the agent in GitHub Actions.** Removes the connection problem entirely
— the client would only ever talk to GitHub. Fails because CI cannot use a Claude
subscription, only a metered API key in repo secrets, and because a workflow
cannot answer a parked question mid-run.

**Requiring Tailscale.** It solves TLS elegantly via `tailscale serve`, and it is
one developer's setup. Users cannot be asked to install a VPN.

**A tunnel, a browser extension, or a native app as the front door.** Each was on
the shortlist only while loopback was in doubt. Loopback is the answer, so none
is needed to ship. They stay on the shelf for one purpose — driving a machine you
are not sitting at — and that is deliberately not now.

### Reach, and its one honest limit

A phone gets the planning half over GitHub and nothing else: it cannot reach a
laptop's loopback, and the options that would let it are the shelved ones above.
That limit is accepted, because plan-only makes a phone genuinely useful rather
than a broken desk.

### Security, which the hosted client makes sharper

The runtime authenticates by network topology: `isTrustedHost` accepts anything
arriving from loopback, private LAN, `.ts.net`, `.local`, this machine's own
hostname, or an entry in `PAPERCAMP_ALLOWED_HOSTS`. That answers "is the caller on
a network that points at this machine", never "is this caller allowed".

A hosted client raises the stakes rather than lowering them: once any web page can
attempt a loopback request, "arrived from loopback" stops being evidence of
anything. Origin checking is already half-built — `isForbiddenRequest` rejects a
foreign `Origin` on every mutating method, so a site a user visits cannot drive
writes today. It can still read, because the check runs on POST/PUT/PATCH/DELETE
only, and no pairing token exists.

Two things close it, and both are work rather than questions. The runtime
allow-lists the hosted client's exact origin and applies the check to reads as
well as writes. And a pairing token, established when the runtime announces
itself and stored with the registry entry, distinguishes the user's own client
from any other caller that happens to know the port.

### Sequencing

Three steps of the original chain shipped with [[IDEA-193]] (PR #184) and are
archived: contract and auth, capability-aware modules, and the plugin split. Of
the two that shipped only in part, what survives is listed below as its own
ticket. Every ticket on this board is work nobody has done.

1. [[TICKET-2]] Persist a runtime and its pairing token device-locally. The
   client can already dial a runtime from a query string; nothing remembers it,
   which is the seam the registry needs.
2. [[IDEA-204]] Deploy the hosted client — the static bundle on a CDN, which is
   what makes the URL a front door rather than a plan.
3. [[IDEA-205]] The hub shell — welcome, connect GitHub, and the projects list,
   the surface a URL with no project behind it has to show.
4. [[TICKET-4]] GitHub import and scaffold-by-PR. Reading and writing a corpus
   over the API already ships; getting a repo *into* that state does not.
5. [[IDEA-117]] Multi-project registry, fan-out and switcher — the hub itself,
   which everything above exists to make possible.

[[IDEA-204]], [[IDEA-205]] and [[IDEA-117]] are tickets on this board and kept
their own ids: a new ticket is minted as `TICKET-N`, but an idea promoted onto a
board keeps the id every existing link already points at.

### Thread
- [x] 2026-08-21 [decision] The hosted client reaches the runtime over the loopback carve-out, which is the settled front door; the residual work is the Private Network Access preflight and CORS headers, not a measurement, so [[IDEA-193]]'s measurement phase is dropped.
- [x] 2026-08-21 [decision] Plan-only is a first-class state a project can sit in indefinitely: with no runtime the client still does the whole planning half by talking to GitHub, and only execution needs the local machine.
- [x] 2026-08-21 [decision] The client holds a fine-grained GitHub token the user mints and pastes in, so "the client holds nothing" is rewritten to no corpus, no account, and no credential it did not get from the user's own authorization. Device flow was measured and rejected: `github.com/login/*` sends no CORS headers, `api.github.com` does, so only acquisition was ever blocked and a hosted shim to fix it would be the backend this architecture refuses.
- [x] 2026-08-21 [decision] The no-runtime experience is the same app with capability-aware modules that report what they can do, never a separate reduced build.
- [x] 2026-08-21 [decision] Local hosting via `paper-camp dev` with the in-app toolbar stays fully supported alongside the hosted client — the same bundle from a different origin, needing no transport work.
- [x] 2026-08-21 [decision] One runtime per repository, not one managing many: the runtime stays a repo dev dependency and the client fans out across N of them, so [[IDEA-117]]'s hub is a client concern rather than a runtime one.
- [x] 2026-08-21 [decision] The project registry lives in the client's device-local browser storage, alongside each runtime's pairing token.
- [x] 2026-08-21 [decision] Folder scanning is dropped: a project enters the registry when its runtime announces itself, or through GitHub import when it has no runtime yet.
- [x] 2026-08-21 [decision] Tunnels, a browser extension and a native app are shelved rather than rejected — none is needed for the front door, and they exist only for driving a machine you are not sitting at.
- [x] 2026-08-21 [log] [agent] Run order: Undrafted foundation note every other multi-project item explicitly rests on and must be settled before any dependent work starts
