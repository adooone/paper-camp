---
id: IDEA-304
title: CI as one line per workflow
type: feat
status: done
created: 2026-10-18
updated: 2026-10-18
tags:
  - app
  - server
  - ci
  - github
subject: Run & monitor
order: 11
---

The *CI & release* card in the Stack panel is six to eight lines tall at
rest: a row per workflow, a mono "Released X · Queued Y" line, a links row
for the release PR and Actions, and with Draft PR on, that workflow's last
run plus a two-step secrets checklist. Nothing says when GitHub was last
read; `fetchCiReleaseState` keeps `fetchedAt` in its cache and never sends
it, so a card can show hours-old state with no hint and no refresh short of
the toolbar's. When the run list call fails but the release call succeeds,
`available` stays true and the card says *No recent runs on main*, an error
shown as a fact. Failed job names sit inline after the status with
`shrink-0`, so three of them push past the panel width. The secrets check
calls `repos/{repo}/actions/secrets`, which needs admin, so for anyone else
both secrets read as missing and the checklist shows for a flow that works.
The checklist is setup guidance in a status panel; Draft PR is switched on
in Settings, where IDEA-289 said readiness belongs. `useCiRelease` is a
`useState` fetcher refetching when the store's `refreshing` flag flips back,
the loading state is a *Checking CI…* card unlike every other section, and
the skeleton reserves 28 px for a card that renders eight lines. This idea
gives the group the row grammar of IDEA-303 and links every row straight to
GitHub, which already has the page an in-app mirror would copy.

**The state says when and whether.** `CiReleaseState` gains `fetchedAt:
string` and `runs` becomes `CiRun[] | null`, null when the run list call
failed. `GET /api/ci?fresh=1` clears this repo's cache entry before reading.
`DraftPrReadiness` gains `secretsChecked: boolean`, false when the secrets
call failed, so a missing secret and an unanswered check are told apart.
`withFailedJobs` and the rest of `ci-release.ts` stay; tests cover the three
additions.

**CI is a query.** `useCiRelease` is rewritten on `useQuery(['ci'])` keyed
per runtime with `staleTime: Infinity`, as the IDEA-299 queries are, plus a
`refresh()` that fetches with `fresh=1` and writes the result into the
cache. `refreshAll` in the status slice invalidates it after
`dropServerCaches`, which replaces the `refreshing` watcher in the group.
GitHub is still read only when asked (IDEA-181): on mount, on the toolbar
refresh, and on the group's own refresh button.

**One card, one line per item.** `CiGroup` renders a single `Card
surface="chalkboard" size="small"` under the *CI & release* label:

```
CI & release                              14:05 ↻
● Checks           passed
● Release          running
● Draft PR         failed
  0.52.0 · 0.53.0 queued
```

The label row puts `formatLastRun(fetchedAt)` in `font-handwritten text-xs
text-desk-text-muted` at the right, where the Agent section puts its *more*
link, followed by an `IconButton` with `RefreshIcon`, `size="tiny"`,
`surface="chalkboard"`, label *Refresh CI*, that calls `refresh()` and shows
a `Spinner size="small"` while it runs. A workflow row is the status dot
(today's `runDotClass`), the workflow name in `text-desk-chalk` truncating,
and the status word in mono muted text; the row is an `<a>` to `run.url` in
a new tab, with `rel="noreferrer"`. The words come from
`ciRunWord(status)` in `src/core/ci/ci-release.ts`: passed, failed, running,
queued, cancelled, unknown. A failed run's job names are the row's `title`
tooltip, never inline. The draft-PR workflow's last run is one more row of
the same shape when `draftPr` is set; when `secretsChecked` is true and a
secret is missing, the word is *secrets missing* in `text-chalk-fail-text`
and the row navigates to `/project/settings/desk` instead of GitHub. The
version line reads `0.52.0 · 0.53.0 queued` in mono muted text linking to
the release PR, `0.52.0 · nothing queued` when Release Please is on and no
PR exists, and `0.52.0` alone when it is off; `—` stands in for an unknown
released version. The *Released … · Queued …* line, the *Release PR* and
*Open Actions* links row and `DraftPrSection` are deleted.

**Three thin states.** `runs === null` renders one muted line *couldn't read
runs* above the version line. `available === false` renders one muted line
*GitHub unavailable*; the refresh button stays, and the fix is in Settings →
Connections already. No CI declared keeps the `EmptyState`. While the query
has no data, `DeskSectionSkeleton` reserves one 20 px row per expected
line: the workflows are unknown, so two rows plus the version line.

**Readiness lives in Settings.** `DeskCiEditor` gets a `SettingRow` under
the Draft PR switch, shown only when the switch is on, reading the same CI
query: *Scout secrets* with the value *SCOUT_APP_ID and SCOUT_PRIVATE_KEY
present*, or *missing: SCOUT_APP_ID* naming each absent one, followed by
the two steps (install the Scout GitHub App on the repo; add the secrets)
as muted text, or *couldn't check — needs admin on the repo* when
`secretsChecked` is false.

Done when the group is one card of one-line rows each linking to its run on
GitHub, the label row shows the read time and a refresh button that rereads
GitHub, the version line links to the release PR, a failed run list and an
unavailable GitHub each render as one muted line, the draft-PR checklist is
gone from the Stack and its readiness shows under the Draft PR switch in
Settings, and the card refetches only on mount, the toolbar refresh and its
own button.

### Out of scope

A CI page in Activity. The `pr-review-status` route's use of
`fetchCiReleaseState`. Polling GitHub on a timer. Editing the manifest beyond
the readiness row.

### Phases
- [x] fetchedAt, null runs and the readiness flag
      `fetchedAt`, `runs: CiRun[] | null` and `secretsChecked` on the state;
      `?fresh=1` clearing the repo's cache entry; `ciRunWord`; the
      `pr-review-status` caller treating null runs as not green; tests.
      run: 3m43s · 66 in · 16.2k out · sonnet-5 · sess:cf4931c8-4e6c-4319-8465-0d7caf29f8e6
- [x] CI as a query
      `useCiRelease` on `useQuery(['ci'])` with `staleTime: Infinity` and
      `refresh()`; `refreshAll` invalidating it; the `refreshing` watcher and
      the hook's `loading` removed; tests.
      run: 3m17s · 74 in · 12.7k out · sonnet-5 · sess:cf4931c8-4e6c-4319-8465-0d7caf29f8e6
- [x] One card of one-line rows
      `CiGroup` as one chalkboard card: the label row with the read time and
      the refresh button, a row per workflow linking to GitHub with the status
      word and the job-name tooltip, the draft-PR row with the secrets state,
      the version line linking to the release PR, the three thin states, the
      sized skeleton; the links row and `DraftPrSection` deleted; tests.
      run: 5m52s · 88 in · 26.4k out · sonnet-5 · sess:cf4931c8-4e6c-4319-8465-0d7caf29f8e6
- [x] Readiness under the Draft PR switch
      The *Scout secrets* `SettingRow` in `DeskCiEditor` reading the CI query
      with the present, missing and unchecked wordings; tests.
      run: 2m36s · 66 in · 9.4k out · sonnet-5 · sess:cd7251e9-9c6b-44d0-8e02-04938e810325
