---
id: IDEA-164
title: Browser-driven page audits
type: feat
status: idea
created: 2026-08-13
updated: 2026-08-13
tags:
  - app
  - agent
  - stack
subject: Run & monitor
---

Auditing a page for UI/UX and code issues — the pass done by hand over the Stack
panel that produced [[IDEA-161]], [[IDEA-162]] and [[IDEA-163]] — becomes
something the desk runs.

Most of the pipeline already exists. `launch-suggest` (`TaskKind: 'suggest'`) is
the runner, `buildSuggestIdeasPrompt` the prompt, `papercamp/suggestions.md` the
holding pen, and `POST /api/suggestions/promote` already mints an idea and
follows with `launch-extend`. `buildSuggestIdeasPrompt` even asks for "a UX gap
you notice while reading the app".

What is missing is not the plumbing — it is the **evidence**. A source-reading
pass would have found perhaps two of the fourteen findings from the manual
audit. The Desk section's clipping needed a measurement at four viewport
heights; "Last built 12:14:38" sitting under "No build command configured"
needed live API state; stale check stamps reading as decoration needed rendered
pixels. None of that is in the JSX.

An audit is therefore `suggest` with a surface as its subject and a running
browser as its evidence.

### The blocker to solve first

`agents/claude-code.ts`'s `buildArgs` applies `--strict-mcp-config` and
`--disallowedTools WebFetch WebSearch` to every headless job, deliberately:
"Headless jobs must be terminal-only … so a phase can't 'visually check' the
app." An audit is the one task kind whose entire purpose is that visual check.

Do not weaken the policy globally, and do not drop `--strict-mcp-config`. Keep
strict mode on and pass `--mcp-config` naming a browser server, so an audit task
gets exactly one MCP server and nothing else, and every other task kind keeps
today's terminal-only behaviour byte-for-byte. `AgentRunOptions` gains a
`browser?: boolean` set only for the audit kind. `WebFetch`/`WebSearch` stay
disallowed — the audit reads the local app, not the web.

opencode has no equivalent and gets no audit support. The launcher is gated on a
`capabilities.ts` probe for a configured browser MCP server, the same way `gh`
and the agent CLIs are probed. With no browser configured the control is
disabled and says why, rather than silently running a degraded source-only pass.

### Targets

A `desk.audits` block in `papercamp/config.json`, hand-declared alongside
`desk.services` and `desk.checks`:

```json
"audits": [
  { "name": "Stack panel", "path": "/", "intent": "Agent activity and the desk's own tooling. Git lives on /git; delivery lives on the idea view." },
  { "name": "Plans", "path": "/", "intent": "One flat status-sorted worklist. The whole card is the click target." }
]
```

`intent` is the load-bearing field and is required, not optional. The manual
audit found real problems rather than generic lint because it had
`UX_PRINCIPLES.md`, `CODE_STYLE.md` and the surface doctrine to audit *against*.
An agent told only "look at this page" returns platitudes. Deriving the target
list from the router is rejected for exactly that reason: it yields bare paths
carrying no statement of intent.

### The run

One task per target, queued through the existing run-all/audit-all fan-out
rather than one task covering everything — each finding stays traceable to a
surface, and a long sweep can be stopped partway.

The service backing a target must be up before its audit launches. The Desk
already knows this from `desk.services[].healthcheck`; an audit whose service is
down does not start and says so. This depends on the healthcheck probe fixed in
[[IDEA-163]] — today a service started outside paper-camp reports `stopped`.

The prompt carries the target's `path` and `intent`, the base URL resolved from
the running service, `docs/UX_PRINCIPLES.md` and `docs/CODE_STYLE.md` as the
standards to audit against, and the existing ideas and suggestions so it does
not re-report what is already filed. Output rules are inherited from
`buildSuggestIdeasPrompt` unchanged: append-only to `suggestions.md`, one line
per finding, never create idea files, no quota, and no edit at all when nothing
is found.

Findings land in the suggestions pen and are promoted by hand. An audit is
noisier than a suggest pass, and promote already dedupes against existing ideas;
minting ideas directly would flood the worklist and remove the cheap dismiss.

### Where it lives

An **Audits** group in the Stack panel's Desk section, next to Checks — one
clickable row per `desk.audits` entry showing its last run, plus a run-all
control. No new route and no new page: the Desk is already "run this project's
own tooling and see what it says", and it is the only surface that already knows
whether the target's service is up.

### Out of scope

Screenshot capture or storage, diffing a surface against its previous run, and
any scheduled or CI-triggered audit — this is a manual, on-demand pass.
Accessibility auditing rides along in the prompt's standards rather than
becoming a separate tool integration.
