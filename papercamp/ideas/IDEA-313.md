---
id: IDEA-313
title: Checks and git that keep their promises
type: fix
status: review
idea: IDEA-308
created: 2026-10-21
tags:
  - server
  - git
  - checks
  - services
subject: Code health
order: 1
---

A review of IDEA-308 against its code found three of its four *Done when*
conditions unmet and a few regressions in the touched server code. Each
item below names the gap and the fix.

**The tree hash misses every edit after the first.** `getTreeHash`
(`src/app/server/git.ts:730`) hashes `git status --porcelain=v2`, whose lines
carry only HEAD and index blob ids, never worktree content. Appending to an
already-modified file twice gives the same hash, so a check stamp goes stale
on the first edit only. The hash becomes two spawns: the porcelain output,
plus `git hash-object --stdin-paths` fed every path the porcelain lists as
modified or untracked (deleted paths skipped). The digest covers both
outputs. The `desk-checks` test stops injecting the fingerprint and edits a
real file twice, asserting the stamp is stale after the second edit.

**A null fingerprint counts as fresh.** In `getCachedOrRunChecks`
(`src/app/server/desk-checks.ts:242`), a missing or failing fingerprint
leaves stored and current both `null`, so a stale result is reused forever.
A `null` fingerprint on either side means not fresh.

**The check routes answer 404 for everything.** `POST /api/checks/run`
(`src/app/server/routes/checks.ts:17`) fires `runCheck` without awaiting it,
and both `/run` and `/fix` map every error to 404. `/run` awaits the run
promise's start and reports an unknown check as 404, anything else as 500
with the message; `/fix` does the same. An unhandled rejection from the run
promise is caught and stored as that check's `fail` with the message.

**Recheck leaves the auth badge stale.** `GET /api/connections?recheck=1`
(`src/app/server/routes/capabilities.ts:28`) clears only the capabilities
cache, so after `claude logout` the badge keeps the old value until the 60 s
TTL lapses. Recheck also clears the cached Claude auth status
(`cachedClaudeAuthStatus`).

**Git status spawns up to ten processes.** `/api/git/status` runs the
snapshot, `stash list` and `getBranchHygieneStatus`, which re-runs
`getCurrentBranch` and a second full `runGitStatus` (`git.ts:487`), then on a
feature branch `isBranchMerged`, two `rev-parse`, `mainRef` and `rev-list`.
`getBranchHygieneStatus` takes the status snapshot as its argument instead of
re-reading, and reads the current branch from the snapshot's `# branch.head`
line. On a feature branch it runs one `git rev-list --left-right --count
<main>...HEAD` where `<main>` is the result of `mainRef()`, resolved once per
git manager and cached for its lifetime; `isBranchMerged` reads the
left-right counts (right count zero means merged) and `stale-merged` is left
count above zero. `/api/git/status` is then at most three spawns on main and
four on a feature branch, asserted by a test counting `runGit` calls.

**A branch with no upstream reports ahead 0.** `# branch.ab` is absent
without an upstream (`git.ts:116`), and the old fallbacks were dropped. When
the header is absent, ahead and behind come from the same `rev-list
--left-right --count` against the cached `mainRef()`, so both sides measure
against one ref.

**Pull swallows a failed fetch.** `runGitPull` now goes through
`fixDivergence`, whose `fetch` has `.catch(() => {})`, so an offline pull
reconciles against stale refs and reports success. `fixDivergence` takes a
`strictFetch` flag that `runGitPull` sets; a failed fetch then throws with
git's message and the route answers 502.

**Commit still races the index.** `git commit` (`git.ts:259`) runs outside
`withIndex`, so a concurrent `stagePath` can hit `index.lock`. The commit
moves inside the same `withIndex` call as its add.

**A service survives unmount while it is starting.** `killAll`
(`src/app/server/desk-services.ts:156`) skips runtimes whose `proc` is still
null during the `import('node-pty')` await, and the spawn then proceeds after
unmount. `start` records a `starting` promise on the runtime before the
import; `killAll` awaits it, then kills. A test starts a service with a
stubbed slow import, unmounts, and asserts no process is left.

Done when editing a modified file a second time makes the lint stamp stale,
a failing fingerprint never reports fresh, an unknown check answers 404 and
a thrown run answers 500, Recheck after `claude logout` flips the badge at
once, `/api/git/status` on a feature branch runs four git processes, a
fresh branch with two local commits reports ahead 2, an offline Pull reports
the fetch failure, and a service started during unmount is dead afterwards.

### Out of scope

Any change to what the checks run or how stamps render. The Services page.

### Phases
- [x] Hash worktree content and reject null fingerprints
      `getTreeHash` adds `hash-object --stdin-paths` over changed and
      untracked paths; `null` fingerprints are never fresh; desk-checks test
      edits a real file twice.
      run: 4m27s · 62 in · 15.4k out · sonnet-5 · sess:9c0d1db0-746e-4b51-baeb-0919d916bc0b
- [x] Honest check routes
      `/run` and `/fix` answer 404 only for unknown checks and 500 with the
      message otherwise; a rejected run promise lands as that check's fail.
      run: 3m51s · 40 in · 17.8k out · sonnet-5 · sess:9c0d1db0-746e-4b51-baeb-0919d916bc0b
- [x] Recheck clears the auth cache
      `?recheck=1` clears `cachedClaudeAuthStatus` too; route test.
      run: 1m24s · 38 in · 4.5k out · sonnet-5 · sess:9c0d1db0-746e-4b51-baeb-0919d916bc0b
- [x] Hygiene from the snapshot and one rev-list
      `getBranchHygieneStatus(snapshot)` with `mainRef()` cached per manager,
      merged and stale from one `rev-list --left-right --count`, no-upstream
      ahead/behind from the same call; a test counts `runGit` calls.
      run: 14m32s · 96 in · 71.6k out · sonnet-5 · sess:3ca964df-a9b7-420b-9e99-07ffa697e4bf
- [x] Pull that fails loudly and a commit under the index lock
      `strictFetch` on `fixDivergence` for `runGitPull` with a 502 on
      failure; `git commit` inside `withIndex`.
      run: 5m41s · 106 in · 17.2k out · sonnet-5 · sess:fdfbd2dc-8a18-4399-982c-e5c17f06d882
- [x] Services die on unmount while starting
      `starting` promise awaited by `killAll`; test with a slow stubbed
      import.
      run: 7m58s · 102 in · 28.9k out · sonnet-5 · sess:fdfbd2dc-8a18-4399-982c-e5c17f06d882

### Thread
- [x] 2026-10-21 [log] [agent] Run order: Fixes correctness-critical git/checks/services regressions (stale fingerprints, swallowed fetch failures, index races) that other work would otherwise build atop or re-break, and is independent of the other three.
- [ ] 2026-10-21 [question] [agent] Run-all parked on phase 4 ("Hygiene from the snapshot and one rev-list") — the agent needs a decision: API Error: 522 {"type":"https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-522/","title":"Error 522: Connection timed out","status":522,"detail":"Cloudflare could not establish a TCP connection to the origin server. The TCP handshake timed out, which may indicate the origin is overloaded, firewalling Cloudflare, or unreachable at the network level.","instance":"a4e3519d3ba5c9d5","error_code":522,"error_name":"connection_timeout","error_category":"origin","ray_id":"a4e3519d3ba5c9d5","timestamp":"2026-10-21T21:23:17Z","zone":"api.anthropic.com","cloudflare_error":true,"retryable":true,"retry_after":120,"owner_action_required":true,"what_you_should_do":"**Wait and retry.** Back off for at least 120 seconds. If the error persists, the website operator should verify firewall rules and ensure the origin accepts connections from Cloudflare IP ranges.","footer":"This error was generated by Cloudflare on behalf of the website owner."}. This is a server-side issue, usually temporary — try again in a moment. If it persists, check https://status.claude.com.
