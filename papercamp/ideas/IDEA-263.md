---
id: IDEA-263
title: Consistency is a manifest check
type: fix
status: idea
created: 2026-09-12
tags:
  - server
  - stack
subject: App UI
order: 1
---

`paper-camp-mobile` showed two red stamps on its first day and had done
nothing wrong. *Consistency* runs a fixed `pnpm run consistency` from
`status.ts` in every project — paper-camp's own knip and depcruise
script — so a project on npm, or one without that script, fails with
"missing script" before the check starts. *Docs* flags every subject as
an orphan in a project with no `ROADMAP.md`, because
`findConsistencyIssues` compares against an empty vocabulary. Both are
paper-camp's shape leaking into other people's repos.

**Consistency comes from the manifest.** The hardcoded command and the
`consistency` slot in the status snapshot go. paper-camp's own desk
manifest lists it as an ordinary check, `Consistency` with
`pnpm run consistency`, and the Stack shows it only because the manifest
does. Desk discovery proposes such a check only for a project whose
scripts run knip, depcruise, or a comparable tool. The run-all sweep,
the fix pass, the baseline, and the night gate run the manifest's checks
by name — lint, test, and whatever else the manifest holds — and never a
command the manifest does not name.

**Docs stays built in, and knows when there is no roadmap.** Every
project has a corpus, so the docs check keeps reading it. The
orphan-subject rule fires only when a roadmap exists and defines a
vocabulary; with no roadmap, subjects are free-form and only the
title-style rule applies. A project that later adds a roadmap gets the
subject check from then on.

**The stamps say what they are.** The Stack's checks group draws the
manifest's checks first, in manifest order, then *Docs* last with its
own reason line; there is no fixed set of four names.

### Out of scope

Changing what knip and depcruise check in paper-camp. Doctor's own
rules.

### Phases
- [x] Move Consistency into the manifest
      Drop `CONSISTENCY_COMMAND`, the `consistency` snapshot slot, and its head-sha
      cache from `status.ts`, and list `Consistency` with `pnpm run consistency`
      among paper-camp's own `desk.checks`.
      run: 5m23s · 82 in · 24.6k out · sonnet-5 · sess:e1d85bce-cd0c-45f4-87be-a350fe2f87db
- [x] Run the manifest's checks by name
      The run-all sweep, the fix pass, the baseline, and the night gate iterate
      `loadManifestChecks` instead of the hardcoded `['lint', 'test']` pair.
      run: 2m59s · 56 in · 11.1k out · sonnet-5 · sess:e1d85bce-cd0c-45f4-87be-a350fe2f87db
- [ ] Trim the consistency types and client state
      `CheckName`, `StatusPayload`, the status SSE messages, the run route, and the
      status slice lose the fixed consistency slot.
- [ ] Gate the orphan-subject rule on a roadmap
      `findConsistencyIssues` skips the subject rule when no vocabulary exists, at
      every call site.
- [ ] Propose Consistency only where it fits
      Desk discovery suggests such a check for knip/depcruise-like scripts only.
- [ ] Draw the checks group from the manifest
      Manifest checks first in manifest order, then Docs last with its own reason.
