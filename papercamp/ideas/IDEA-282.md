---
id: IDEA-282
title: Adopt paper-ui's sketch charts
type: refactor
status: review
created: 2026-09-22
updated: 2026-10-01
tags:
  - app
  - ui
  - paper-ui
subject: One design system
order: 4
---

paper-ui's IDEA-6 ships the four charts this app drew on its own copy of
the generator. Blocked until that release; the first phase bumps the
dependency. Runs after [[IDEA-279]].

**`components/charts/` is deleted.** `hub-numbers-column.tsx` renders the
library's `ArcGauge`, `BarChart` and `StackedBar` with the same props.
`rough-progress-bar.tsx` goes and the roadmap item row renders `Progress
sketch`; the capacity row's `Progress` gains `sketch` too so the two bars
match. `commit-history.tsx` drops `RailLine` and `RailSegment` for
`CommitRail`.

**Parity is the acceptance test.** This idea changes no pixel. The bump
phase is blocked until the paper-ui release has been checked against
paper-camp's own rendering in the browser, and the final phase does not
close until the same pages have been compared again: any difference in
font, size, weight, colour, spacing, texture, border or behaviour is a
fix on the paper-ui idea that shipped the component, not something to
absorb here.

### Out of scope

Any change to what the numbers show.

### Phases
- [x] Bump paper-ui to the release that ships the charts
      run: 45s · 16 in · 1.4k out · sonnet-5 · sess:1e923085-3b18-40b3-bf76-9394a50b6922
- [x] Render the library charts in `hub-numbers-column.tsx`
      run: 55s · 24 in · 2.6k out · sonnet-5 · sess:1e923085-3b18-40b3-bf76-9394a50b6922
- [x] Swap the roadmap bars for `Progress sketch`
      Covers both the item row and the capacity row so they match.
      run: 1m59s · 44 in · 5.3k out · sonnet-5 · sess:1e923085-3b18-40b3-bf76-9394a50b6922
- [x] Swap the commit rail for `CommitRail`
      run: 1m42s · 38 in · 4.5k out · sonnet-5 · sess:1e923085-3b18-40b3-bf76-9394a50b6922
- [x] Delete `components/charts/` and the local generator
      Only after nothing imports them; run the quality checks.
      run: 1m18s · 28 in · 3k out · sonnet-5 · sess:1e923085-3b18-40b3-bf76-9394a50b6922

### Thread
- [x] 2026-09-30 [question] [agent] Run-all parked on phase 1 ("Bump paper-ui to the release that ships the charts") — the agent needs a decision: paper-ui's chart commits (ArcGauge, BarChart, StackedBar, CommitRail, Progress `sketch`) are merged to paper-ui's `main` but no release has been cut — npm's latest published `@dendelion/paper-ui` is still 0.22.6, identical to what paper-camp already has installed, and it does not contain these components. There is no newer release to bump to yet. Should I wait for paper-ui's release-please/CI to publish a new version, or is there another way you want this release cut before I proceed with this phase?
- [x] 2026-09-30 [question] [agent] Run-all parked on phase 1 ("Bump paper-ui to the release that ships the charts") — the agent needs a decision: paper-ui's chart components (ArcGauge, BarChart, StackedBar, CommitRail, Progress `sketch`) still have no published release — npm's latest `@dendelion/paper-ui` is still 0.22.6, same as already installed. This was already logged as an open question on IDEA-282 on 2026-09-30. Should I wait for a release to be cut, or is there another way you want this handled before phase 1 can proceed?
- [x] 2026-09-30 [question] [agent] Run-all parked on phase 1 ("Bump paper-ui to the release that ships the charts") — the agent needs a decision: paper-ui still has no published release containing the sketch charts (npm latest is still 0.22.6). Should I wait for a release to be cut, or do you want this handled another way (e.g. point at a specific commit/tarball) before phase 1 can proceed?
- [x] 2026-09-30 [question] [agent] Run-all parked on phase 1 again — npm's dist-tags now show `@dendelion/paper-ui@0.23.2` as latest (published moments ago via the new OIDC trusted-publishing pipeline, see paper-camp commit 2702c6de), but the tarball itself 404s: `npm view` returns valid metadata (dist.tarball, shasum, integrity) yet `npm install @dendelion/paper-ui@0.23.2` and a direct GET of the tarball URL both fail with "Not Found". The registry entry exists but the package content isn't actually downloadable — looks like a broken/incomplete publish from the OIDC switchover, not a missing release anymore. I can't bump to a version that won't install. Is this expected to resolve on its own (propagation lag) or does the paper-ui publish need to be re-run?
- [x] 2026-09-30 [question] [agent] Run-all parked on phase 1 ("Bump paper-ui to the release that ships the charts") — the agent needs a decision: npm now lists `@dendelion/paper-ui@0.23.2` as the latest version (published moments ago via the new OIDC trusted-publishing pipeline), but the tarball itself 404s — `npm view` returns valid metadata (dist.tarball, shasum, integrity) while `npm install @dendelion/paper-ui@0.23.2` and a direct GET of that tarball URL both fail with "Not Found". This looks like a broken/incomplete publish from the OIDC switchover rather than a missing release, and I can't bump to a version that won't actually install. Should I wait for this to resolve (propagation lag) or does the paper-ui publish need to be re-run?
- [x] 2026-10-01 [clarification] Decision: proceed. 0.23.2 is published through the new trusted-publishing pipeline and its tarball is fetchable now; the 404 you saw was npm's CDN propagating for a few minutes after publish. package.json is already bumped to ^0.23.2 and installed, types and tests pass, and the build exports ArcGauge, BarChart, StackedBar, CommitRail and Progress sketch. Treat phase 1 as done and continue with phase 2. If npm ever answers 404 for a tarball whose metadata exists, wait two minutes and retry before parking.
- [x] 2026-10-01 [chat] [agent] Got it — treating phase 1 as done since 0.23.2's tarball is now fetchable and the bump/install/types/tests are confirmed. Continuing with phase 2: rendering ArcGauge/BarChart/StackedBar in hub-numbers-column.tsx.
- [x] 2026-10-01 [log] [agent] Phase 1 (paper-ui 0.23.2 bump/install/types/tests) confirmed done; work moved to phase 2, rendering ArcGauge/BarChart/StackedBar in hub-numbers-column.tsx.
